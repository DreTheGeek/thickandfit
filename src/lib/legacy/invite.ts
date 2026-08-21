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
import { emailShell, emailButton } from '@/lib/email/shell';

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
  // Voice: Coach Steph (see .planning/STEPHANIE-VOICE-BIBLE.md). Warm, real, leads with what she
  // keeps (her progress), one clear action, no hype, no em dashes. Draft pending Stephanie's sign-off.
  if (locale === 'es') {
    const body = [
      `<p>Hola${name ? ' ' + name : ''}:</p>`,
      '<p>Por años te entrené en la plataforma de alguien más. Eso se acabó. Nos construí nuestra ',
      'propia casa, la app de Thick &amp; Fit, y todo lo que hizo que esto funcionara está aquí: tus ',
      'entrenamientos con mis videos, un registro de comida que por fin entiende cómo comemos ',
      'nosotras, nuestra comunidad, y yo contigo cada día.</p>',
      '<p>Y lo mejor: tus fotos de progreso y todo lo que has logrado se vienen contigo. Un toque y ',
      'ahí está, esperándote.</p>',
      '<p>Esto no es una carrera, es un maratón, y apenas llegamos a lo bueno. Estoy tan agradecida ',
      'de que hayas confiado en mí hasta aquí. Ven a ver lo que construí para nosotras.</p>',
      emailButton(actionLink, 'Activar mi cuenta'),
      '<p>Vamos con todo. Nos vemos adentro. 🤍<br/>Steph</p>',
    ].join('');
    return {
      subject: 'Nos mudamos, y te guardé tu lugar',
      html: emailShell({ bodyHtml: body, preheader: 'Tu nueva casa en la app te espera' }),
    };
  }
  const body = [
    `<p>Hey${name ? ' ' + name : ''},</p>`,
    "<p>For years I coached you on someone else's platform. Not anymore. I built us our own home, ",
    'the Thick &amp; Fit app, and everything that made this work is right here: your workouts with ',
    'my demos, food tracking that finally gets the way we eat, our community, and me in your corner ',
    'every day.</p>',
    "<p>And here's the best part. Your progress photos and everything you've earned come with you. ",
    'One tap and it is all there waiting.</p>',
    "<p>This isn't a race, it's a marathon, and we're just getting to the good part. I'm so grateful ",
    'you have trusted me this far. Come see what I built for us.</p>',
    emailButton(actionLink, 'Activate my account'),
    "<p>Let's go. I'll see you inside. 🤍<br/>Steph</p>",
  ].join('');
  return {
    subject: "I built us something. Your spot's ready.",
    html: emailShell({ bodyHtml: body, preheader: 'Your new home in the app is waiting' }),
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

  // DRY RUN RETURNS BEFORE generateLink, AND THAT ORDER IS THE WHOLE POINT.
  //
  // generateLink({ type: 'invite' }) CREATES THE AUTH USER as a side effect of minting the link.
  // It is not a read. The previous version generated the link and then skipped only the send, so a
  // dry run silently provisioned an account for a real client and reported `sent: false`, which
  // reads as "nothing happened". It happened once, to a real person, on production.
  //
  // A dry run must confirm the CONTACT is invitable, which the caller's query has already done by
  // the time we are here: legacy, unclaimed, has an email, in this company. That is everything a
  // dry run can honestly check without causing the thing it is checking.
  if (dryRun) return { email: contact.email, linked: true, sent: false };

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
  opts: { dryRun?: boolean; limit?: number; email?: string } = {},
): Promise<InviteBatchResult> {
  const dryRun = opts.dryRun ?? true; // SAFE DEFAULT: do not send unless explicitly told to
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 1000);
  const svc = createServiceClient();

  /**
   * ONE NAMED PERSON, not the batch. Moving a single client across is the normal first move: you
   * pick someone, you invite her, you watch it land.
   *
   * THE EMAIL IS FILTERED IN THE QUERY, and it has to be. It used to be matched in memory against
   * the rows this query returned, AFTER .limit() had already been applied. So a single invite could
   * only ever reach somebody inside the first page: with the screen's limit of 1 it fetched one
   * contact, looked for the wanted address in that array of one, and reported "not one this can
   * invite" for everybody else. Even at the default 50, client number 200 was uninvitable and the
   * message blamed her for already having an account.
   *
   * Every other predicate stays on the same builder, so a single invite still cannot reach anyone
   * the batch would refuse: already claimed, not a legacy client, no email, another tenant. Adding
   * it here rather than in a separate query is what keeps that guarantee.
   */
  let query = svc
    .from('contacts')
    .select('id, company_id, email, first_name, language')
    .eq('company_id', companyId)
    .eq('type', 'client')
    .eq('is_legacy', true)
    .is('profile_id', null)
    .not('email', 'is', null);
  if (opts.email) query = query.ilike('email', opts.email.trim());

  const { data: contacts, error } = await query.limit(opts.email ? 1 : limit);

  if (opts.email) {
    const one = ((contacts ?? []) as LegacyContact[])[0] ?? null;
    if (!one) {
      return { dryRun, total: 0, linked: 0, sent: 0, outcomes: [] };
    }
    const outcome = await inviteLegacyContact(one, origin, dryRun);
    return {
      dryRun,
      total: 1,
      linked: outcome.linked ? 1 : 0,
      sent: outcome.sent ? 1 : 0,
      outcomes: [outcome],
    };
  }

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
