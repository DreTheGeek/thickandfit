// Public support page. Reachable WITHOUT a login, on purpose.
//
// Two hard requirements land on this one URL:
//   1. App Store Connect takes a Support URL, and a reviewer opens it signed out. A page behind auth
//      fails review.
//   2. Guideline 1.2 requires "published contact information" whenever user-generated content ships.
//      The community shipped; the moderation controls (filter, report, block) all point here.
//
// There was an in-app support widget and an admin ticket board, but no public page at all, so
// /support 404'd while being cited as the published contact point.
import type { ReactElement } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { localeAlternates } from '@/lib/seo/locale-alternates';
import { PageTitle } from '@/components/ui/section';
import { SupportForm } from '@/components/support/support-form';

export const dynamic = 'force-dynamic';

// Intentionally unused for now. hello@teamthickandfit.com has no MX record, so it BOUNCES; showing
// it as the support contact pointed members and App Store reviewers at a dead end. Kept here as the
// address to restore once Resend inbound is configured.
// const SUPPORT_EMAIL = 'hello@teamthickandfit.com';

export async function generateMetadata(): Promise<Metadata> {
  const es = (await getLocale()) === 'es';
  return {
    title: es ? 'Soporte · Thick & Fit' : 'Support · Thick & Fit',
    description: es
      ? 'Cómo contactar al equipo de Thick & Fit para ayuda con tu cuenta, tu pago o la comunidad.'
      : 'How to reach the Thick & Fit team for help with your account, billing, or the community.',
    alternates: await localeAlternates('/support'),
  };
}

export default async function SupportPage(): Promise<ReactElement> {
  const es = (await getLocale()) === 'es';

  const topics = es
    ? [
        { h: 'Tu cuenta', b: 'Problemas para entrar, cambiar tu correo o tu contraseña.' },
        { h: 'Pagos', b: 'Cobros, recibos, cancelar tu suscripción o pedir una aclaración.' },
        { h: 'La comunidad', b: 'Reportar una publicación, bloquear a alguien o avisarnos de algo serio.' },
        { h: 'Tu plan', b: 'Ajustes a tus entrenamientos, tus macros o tu perfil de salud.' },
      ]
    : [
        { h: 'Your account', b: 'Trouble signing in, changing your email, or resetting your password.' },
        { h: 'Billing', b: 'Charges, receipts, cancelling your subscription, or asking about a payment.' },
        { h: 'The community', b: 'Reporting a post, blocking someone, or flagging something serious.' },
        { h: 'Your plan', b: 'Adjusting your workouts, your macros, or your health profile.' },
      ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-ink">
      <PageTitle>{es ? 'Soporte' : 'Support'}</PageTitle>

      <p className="mt-4 text-[15px] leading-relaxed text-soft">
        {es
          ? 'Llena el formulario y una persona real te responde. Normalmente el mismo día, y siempre dentro de dos días hábiles.'
          : 'Fill in the form and a real person answers. Usually the same day, and always within two business days.'}
      </p>

      {/*
        THE FORM IS THE CONTACT PATH, and until inbound email is configured it is the ONLY one.
        `teamthickandfit.com` has no MX record (verified against Cloudflare + Google DNS on
        2026-07-31, and port 25 on the A record is closed), so mail to hello@ BOUNCES. This page
        used to lead with a big mailto button pointing at that address, which meant the published
        support contact, the one App Store review reads under guideline 1.2, was a dead end.
        A working form satisfies "published contact information"; a bouncing address does not.

        RESTORE THE ADDRESS once Resend inbound is live (MX -> Resend, inbound route ->
        /api/support/inbound, RESEND_WEBHOOK_SECRET set). At that point mail becomes a real second
        channel and lands in the same board as the form. See .planning/SUPPORT-TRIAGE-AGENT.md.
      */}
      <section className="mt-8">
        <SupportForm es={es} />
      </section>

      <section className="mt-12">
        <h2 className="text-[18px] font-semibold">{es ? 'Con qué te ayudamos' : 'What we help with'}</h2>
        <div className="mt-4 flex flex-col gap-4">
          {topics.map((tp) => (
            <div key={tp.h}>
              <div className="text-[15px] font-semibold text-ink">{tp.h}</div>
              <p className="mt-0.5 text-[14px] leading-relaxed text-soft">{tp.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[18px] font-semibold">
          {es ? 'Reportar algo en la comunidad' : 'Reporting something in the community'}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-soft">
          {es
            ? 'Cada publicación tiene un menú con Reportar y Bloquear. Los reportes llegan a una persona del equipo, no a una cola automática. Si alguien está en peligro, usa el formulario de arriba y lo atendemos primero.'
            : 'Every post has a menu with Report and Block. Reports go to a person on the team, not an automated queue. If someone is in danger, use the form above and we will handle it first.'}
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-[18px] font-semibold">{es ? 'Tus datos' : 'Your data'}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-soft">
          {es
            ? 'Puedes descargar o borrar tu cuenta tú misma desde Cuenta dentro de la app. Si quieres saber qué guardamos de ti, pregúntanos con el formulario de arriba.'
            : 'You can export or delete your account yourself from Account inside the app. If you want to know what we hold about you, ask us using the form above.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
            {es ? 'Política de Privacidad' : 'Privacy Policy'}
          </Link>
          <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
            {es ? 'Términos' : 'Terms'}
          </Link>
          <Link href="/disclaimer" className="underline underline-offset-2 hover:text-ink">
            {es ? 'Aviso de salud' : 'Health disclaimer'}
          </Link>
        </div>
      </section>

      <Link
        href="/"
        className="mt-14 inline-block text-sm text-muted underline-offset-4 transition hover:text-ink hover:underline"
      >
        {es ? '← Volver al inicio' : '← Back to home'}
      </Link>
    </main>
  );
}
