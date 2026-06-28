// resend-webhook (Deno edge function). Signature-verified Resend webhook.
// email.bounced / email.complained -> add to email_suppression_list + update email_send_log.
import { serviceClient, apiSuccess, apiError } from '../_shared/api.ts';
import { Webhook } from 'https://esm.sh/svix@1.24.0';

const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')!;

type ResendEvent = {
  type: string;
  // Resend includes the provider message id (email_id) on delivery events.
  data?: { email?: string; to?: string[]; email_id?: string };
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return apiError('Method not allowed', 405);

  const payload = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event: ResendEvent;
  try {
    event = new Webhook(webhookSecret).verify(payload, headers) as ResendEvent;
  } catch {
    return apiError('Invalid signature', 401);
  }

  const email = event.data?.to?.[0] ?? event.data?.email ?? null;
  const providerMessageId = event.data?.email_id ?? null;
  const supabase = serviceClient();

  if ((event.type === 'email.bounced' || event.type === 'email.complained') && email) {
    const reason = event.type === 'email.bounced' ? 'bounced' : 'complained';
    // Suppression is intentionally global: a hard bounce / complaint for an address
    // applies across all tenants, so the suppression list is keyed by email only.
    const { error: suppressErr } = await supabase
      .from('email_suppression_list')
      .upsert({ email, reason }, { onConflict: 'email' });

    // The send-log update is tenant-scoped. Resend gives us the provider message id,
    // which maps to exactly one log row (one company). Update by that when present so we
    // never flip another tenant's identical to_email. Fall back to the global match only
    // when the message id is absent (legacy/partial payloads).
    const { error: logErr } = providerMessageId
      ? await supabase
          .from('email_send_log')
          .update({ status: reason })
          .eq('provider_message_id', providerMessageId)
      : await supabase.from('email_send_log').update({ status: reason }).eq('to_email', email);

    // Surface storage failures with a non-2xx so Resend retries, instead of silently dropping a
    // suppression (which would let us keep emailing a complained address -> spam-trap / deliverability
    // damage). A 0-row update is not an error here; only a real DB failure sets .error.
    if (suppressErr || logErr) {
      console.error('resend-webhook write failed', suppressErr?.message, logErr?.message);
      return apiError('Storage error', 500);
    }
  }

  return apiSuccess({ received: true, type: event.type });
});
