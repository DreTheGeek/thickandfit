// resend-webhook (Deno edge function). Signature-verified Resend webhook.
// email.bounced / email.complained -> add to email_suppression_list + update email_send_log.
import { serviceClient, apiSuccess, apiError } from '../_shared/api.ts';
import { Webhook } from 'https://esm.sh/svix@1.24.0';

const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')!;

type ResendEvent = {
  type: string;
  data?: { email?: string; to?: string[] };
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
  const supabase = serviceClient();

  if ((event.type === 'email.bounced' || event.type === 'email.complained') && email) {
    const reason = event.type === 'email.bounced' ? 'bounced' : 'complained';
    await supabase.from('email_suppression_list').upsert({ email, reason }, { onConflict: 'email' });
    await supabase.from('email_send_log').update({ status: reason }).eq('to_email', email);
  }

  return apiSuccess({ received: true, type: event.type });
});
