import 'server-only';
// The welcome email, sent the moment onboarding completes.
//
// WHY IT EXISTS. Until 2026-08-03 nothing at all fired when a member finished onboarding. No email,
// no notification, no message. Rodney signed up, answered every question, landed on a dashboard, and
// the only thing that ever spoke to him was a streak badge he earned himself by logging a meal. The
// product premise is her voice and her method; the first ten minutes delivered silence.
//
// WHAT IT SAYS, and the order is deliberate:
//   1. Her numbers, because she just answered fifteen questions and this is the payoff.
//   2. What to do in the next ten minutes, because "wait for your coach" is not a first session.
//   3. When the program lands, stated honestly rather than implied.
//
// Voice per .planning/STEPHANIE-VOICE-BIBLE.md: warm, direct, leads with what she gets, one clear
// action, no hype, no em dashes. Bilingual, because half this audience reads Spanish.
import { emailShell, emailButton } from '@/lib/email/shell';
import { createServiceClient } from '@/lib/supabase/service';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM || 'Steph <steph@teamthickandfit.com>';
const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.teamthickandfit.com').replace(/\/+$/, '');

export type WelcomeTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/**
 * Compose it. PURE and exported so the copy is reviewable and testable without sending anything.
 */
export function welcomeEmail(
  firstName: string | null,
  targets: WelcomeTargets,
  locale: 'en' | 'es',
): { subject: string; html: string } {
  const name = (firstName ?? '').trim();
  const { calories, proteinG, carbsG, fatG } = targets;

  // The numbers block, identical in both languages because digits do not translate. Table-based and
  // inline-styled like the rest of the shell: Gmail and Outlook strip <style> and flexbox.
  const numbers = (kcalLabel: string, pLabel: string, cLabel: string, fLabel: string): string =>
    [
      '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0;border-collapse:separate;">',
      '<tr><td style="background:#f4f2ee;border-radius:12px;padding:16px 18px;">',
      `<div style="font-size:13px;color:#757575;letter-spacing:.6px;text-transform:uppercase;">${kcalLabel}</div>`,
      `<div style="font-size:30px;font-weight:700;color:#0f0f0f;line-height:1.2;">${calories}</div>`,
      `<div style="font-size:14px;color:#3d3d3d;padding-top:6px;">${pLabel} ${proteinG}g &nbsp;·&nbsp; ${cLabel} ${carbsG}g &nbsp;·&nbsp; ${fLabel} ${fatG}g</div>`,
      '</td></tr></table>',
    ].join('');

  if (locale === 'es') {
    const body = [
      `<p>Hola${name ? ' ' + name : ''}:</p>`,
      '<p>Ya está. Contestaste todo y con eso te armé tus números. Esto es lo que tu cuerpo necesita ',
      'cada día para llegar a donde quieres ir.</p>',
      numbers('Tus calorías al día', 'Proteína', 'Carbohidratos', 'Grasa'),
      '<p><b>Empieza por aquí, hoy mismo:</b></p>',
      '<p>1. Registra lo que comas hoy. Tómale foto y yo me encargo del resto. Con un solo día ya ',
      'empiezo a ver cómo comes.<br/>',
      '2. Súbete a la báscula y toma tus fotos de inicio. Vas a querer tenerlas.<br/>',
      '3. Pásate por la comunidad y saluda. Ahí andamos todas.</p>',
      '<p>Tu plan de entrenamiento te lo armo yo a mano con lo que me contaste, así que dame un poco ',
      'de tiempo. Mientras llega, la comida es lo que más mueve la aguja, y eso ya lo puedes empezar ',
      'hoy.</p>',
      emailButton(`${APP_URL}/nutrition`, 'Registrar mi primera comida'),
      '<p>Estoy contigo en esto. Cualquier cosa me escribes por la app.</p>',
      '<p>Vamos con todo. 🤍<br/>Steph</p>',
    ].join('');
    return {
      subject: 'Tus números están listos',
      html: emailShell({ bodyHtml: body, preheader: `${calories} calorías al día. Empecemos hoy.` }),
    };
  }

  const body = [
    `<p>Hey${name ? ' ' + name : ''},</p>`,
    "<p>That's it. You answered everything and I built your numbers from it. This is what your body ",
    'needs each day to get where you said you want to go.</p>',
    numbers('Your daily calories', 'Protein', 'Carbs', 'Fat'),
    '<p><b>Start here, today:</b></p>',
    '<p>1. Log what you eat today. Take a photo and I will handle the rest. One day is enough for me ',
    'to start seeing how you eat.<br/>',
    '2. Step on the scale and take your starting photos. You will want these later.<br/>',
    '3. Come say hi in the community. We are all in there.</p>',
    '<p>I build your training plan by hand from what you told me, so give me a little time on that ',
    'one. While you wait, food is what moves the needle most, and you can start that today.</p>',
    emailButton(`${APP_URL}/nutrition`, 'Log my first meal'),
    '<p>I am in this with you. Message me in the app any time.</p>',
    "<p>Let's go. 🤍<br/>Steph</p>",
  ].join('');
  return {
    subject: 'Your numbers are ready',
    html: emailShell({ bodyHtml: body, preheader: `${calories} calories a day. Let's start today.` }),
  };
}

/**
 * Send it, and record the attempt.
 *
 * NEVER THROWS. It is called from the onboarding submit path, and a member who has just answered
 * fifteen questions must not see an error because an email provider had a bad minute. A missing
 * welcome email is recoverable; a failed onboarding submit sends her back through the whole wizard.
 */
export async function sendWelcomeEmail(args: {
  companyId: string;
  to: string;
  firstName: string | null;
  targets: WelcomeTargets;
  locale: 'en' | 'es';
}): Promise<{ sent: boolean }> {
  const svc = createServiceClient();
  const log = async (status: string, providerId: string | null): Promise<void> => {
    try {
      await svc.from('email_send_log').insert({
        company_id: args.companyId,
        to_email: args.to,
        template: 'welcome',
        status,
        provider_message_id: providerId,
      });
    } catch (e) {
      console.error('sendWelcomeEmail log:', e instanceof Error ? e.message : e);
    }
  };

  if (!apiKey) {
    // Logged, not silent. "No key configured" and "provider rejected it" are different problems and
    // /health reads this table to tell them apart.
    await log('skipped_no_key', null);
    return { sent: false };
  }

  try {
    const { subject, html } = welcomeEmail(args.firstName, args.targets, args.locale);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: args.to, subject, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error('sendWelcomeEmail:', res.status, (await res.text()).slice(0, 200));
      await log('failed', null);
      return { sent: false };
    }
    const json = (await res.json()) as { id?: string };
    await log('sent', json.id ?? null);
    return { sent: true };
  } catch (e) {
    console.error('sendWelcomeEmail:', e instanceof Error ? e.message : e);
    await log('failed', null);
    return { sent: false };
  }
}
