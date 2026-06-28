// Legacy-client invite (WP13, admin). Mints a single-use Supabase invite link per legacy client
// contact and emails it through the existing Resend fetch path with a bilingual (EN/ES) template,
// logging each send to email_send_log. The link lands on /auth/callback?next=/claim, so first login
// runs the claim flow (claim.ts).
//
// SAFETY: this is a production launch action (real client inboxes). It is dryRun BY DEFAULT: it
// generates and returns the links WITHOUT sending. A real batch must be called explicitly with
// dryRun=false AND a verified Resend sending domain AND Stephanie's go-ahead. Idempotent on the
// claim side (re-inviting a claimed contact is harmless: the claim RPC is a no-op once profile_id
// is set), and we skip contacts that already have a profile_id.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? 'Thick & Fit <hello@teamthickandfit.com>';

export type LegacyContact = {
  id: string;
  company_id: string;
  email: string;
  first_name: string | null;
  language: string | null;
};

export type InviteOutcome = {
  email: string;
  linked: boolean; // a link was minted
  sent: boolean; // an email actually went out (false in dryRun or without a key)
  error?: string;
};

export type InviteBatchResult = {
  dryRun: boolean;
  total: number;
  linked: number;
  sent: number;
  outcomes: InviteOutcome[];
};

// Bilingual invite email. Spanish for es-tagged contacts, English otherwise. No em dashes.
function inviteEmail(
  firstName: string | null,
  actionLink: string,
  locale: 'en' | 'es',
): { subject: string; html: string } {
  const name = (firstName ?? '').trim();
  if (locale === 'es') {
    return {
      subject: 'Tu nueva app de Thick & Fit te espera',
      html: [
        `<p>Hola${name ? ' ' + name : ''},</p>`,
        '<p>Construí algo solo para nosotras: la nueva app de Thick & Fit, con tus entrenamientos, ',
        'seguimiento de nutrición sin fricción y tu coach, todo en un solo lugar.</p>',
        '<p>Activa tu cuenta y recupera tus fotos de progreso con un toque:</p>',
        `<p><a href="${actionLink}">Activar mi cuenta</a></p>`,
        '<p>Nos vemos adentro.<br/>Stephanie</p>',
      ].join(''),
    };
  }
  return {
    subject: 'Your new Thick & Fit app is ready',
    html: [
      `<p>Hi${name ? ' ' + name : ''},</p>`,
      '<p>I built something just for us: the new Thick & Fit app, with your workouts, ',
      'low-friction nutrition tracking, and your coach all in one place.</p>',
      '<p>Activate your account and bring your progress photos with you in one tap:</p>',
      `<p><a href="${actionLink}">Activate my account</a></p>`,
      '<p>See you inside.<br/>Stephanie</p>',
    ].join(''),
  };
}

async function sendInviteEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; providerId: string | null }> {
  if (!apiKey) return { ok: false, providerId: null };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) return { ok: false, providerId: null };
    const json = (await res.json()) as { id?: string };
    return { ok: true, providerId: json.id ?? null };
  } catch {
    return { ok: false, providerId: null };
  }
}

// Invite a single contact. Mints the link; sends only when dryRun is false (and a key exists).
export async function inviteLegacyContact(
  contact: LegacyContact,
  origin: string,
  dryRun: boolean,
): Promise<InviteOutcome> {
  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.generateLink({
    type: 'invite',
    email: contact.email,
    options: { redirectTo: `${origin}/auth/callback?next=/claim` },
  });
  if (error || !data?.properties?.action_link) {
    return { email: contact.email, linked: false, sent: false, error: error?.message ?? 'no_link' };
  }
  const actionLink = data.properties.action_link;
  const locale = contact.language === 'es' ? 'es' : 'en';
  const { subject, html } = inviteEmail(contact.first_name, actionLink, locale);

  if (dryRun) return { email: contact.email, linked: true, sent: false };

  const send = await sendInviteEmail(contact.email, subject, html);
  // Record the send attempt for deliverability tracking + the resend-webhook to update on bounce.
  await svc.from('email_send_log').insert({
    company_id: contact.company_id,
    to_email: contact.email,
    template: 'legacy_invite',
    status: send.ok ? 'sent' : 'failed',
    provider_message_id: send.providerId,
  });
  return { email: contact.email, linked: true, sent: send.ok };
}

// Invite the unclaimed legacy client contacts in a tenant. dryRun (default true) never sends.
// limit caps the batch. Returns per-contact outcomes for an operator dashboard.
export async function inviteLegacyClients(
  companyId: string,
  origin: string,
  opts: { dryRun?: boolean; limit?: number } = {},
): Promise<InviteBatchResult> {
  const dryRun = opts.dryRun ?? true; // SAFE DEFAULT: do not send unless explicitly told to
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 1000);
  const svc = createServiceClient();

  const { data: contacts, error } = await svc
    .from('contacts')
    .select('id, company_id, email, first_name, language')
    .eq('company_id', companyId)
    .eq('type', 'client')
    .eq('is_legacy', true)
    .is('profile_id', null)
    .not('email', 'is', null)
    .limit(limit);

  if (error) {
    console.error('inviteLegacyClients read:', error.message);
    return { dryRun, total: 0, linked: 0, sent: 0, outcomes: [] };
  }

  const rows = (contacts ?? []) as LegacyContact[];
  const outcomes: InviteOutcome[] = [];
  for (const c of rows) {
    if (!c.email) continue;
    outcomes.push(await inviteLegacyContact(c, origin, dryRun));
  }

  return {
    dryRun,
    total: rows.length,
    linked: outcomes.filter((o) => o.linked).length,
    sent: outcomes.filter((o) => o.sent).length,
    outcomes,
  };
}
