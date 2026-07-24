// Health / assumption-of-risk disclaimer — PUBLIC route.
//
// Serves two audiences from the same URL:
//   1) Prospective members reading BEFORE signup (liability shield — they see the risks named
//      and the 18+/voluntary-participation language before they hand over money or start moving)
//   2) Signed-in members who haven't yet acknowledged: requireEntitled redirects them here from
//      any training surface, they read the same copy, tap Accept, health_ack_at gets stamped.
//
// The Accept form only renders for authed viewers; unauthed viewers see a Sign up / Sign in CTA
// so they can join and be routed here again by the entitlement guard. hasAckedHealth is checked
// so an already-acked member sees a short "you're set" panel instead of a redundant Accept button.
import type { ReactElement } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { hasAckedHealth } from '@/lib/billing/entitlement';
import { acceptHealthAction } from '@/lib/account/actions';
import { localeAlternates } from '@/lib/seo/locale-alternates';
import { PageTitle } from '@/components/ui/section';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app.disclaimer');
  return {
    title: `${t('title')} · Thick & Fit`,
    description: t('p1'),
    alternates: await localeAlternates('/disclaimer'),
    // Legal / assumption-of-risk copy should be crawlable so people (and their lawyers) can find it.
    robots: { index: true, follow: true },
  };
}

export default async function DisclaimerPage(): Promise<ReactElement> {
  const t = await getTranslations('app.disclaimer');
  const a = await getTranslations('auth');

  // Public route — no requireAuth. Read the session opportunistically so we can render the
  // right CTA for the viewer's state (unauthed / authed-unacked / authed-acked).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const acked = user ? await hasAckedHealth(user.id) : false;

  return (
    <div className="mx-auto max-w-lg px-[22px] py-14">
      <PageTitle className="mb-4">{t('title')}</PageTitle>
      <div className="space-y-3 text-[14px] leading-relaxed text-soft">
        <p>{t('p1')}</p>
        <p>{t('p2')}</p>
        <p>{t('p3')}</p>
      </div>

      {user && !acked && (
        // Post-signup guarded flow: entitlement guard redirected the member here; the tap here
        // stamps profiles.health_ack_at (via acceptHealthAction) and lets requireEntitled advance.
        <form action={acceptHealthAction} className="mt-8">
          <button
            type="submit"
            className="tf-press w-full rounded-full bg-ink py-3.5 text-[13px] font-semibold uppercase tracking-[2px] text-bg"
          >
            {t('accept')}
          </button>
        </form>
      )}

      {user && acked && (
        <p className="mt-8 rounded-md border border-line bg-surface px-4 py-3 text-[13px] text-muted">
          {t('acked')}
        </p>
      )}

      {!user && (
        // Pre-signup readability: this page must be discoverable and readable BEFORE anyone
        // parts with money. The CTA points at the waitlist rather than sign-in because during
        // pre-launch the site's own front door is /join; a returning member takes the Sign in link.
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/join"
            className="tf-press w-full rounded-full bg-ink py-3.5 text-center text-[13px] font-semibold uppercase tracking-[2px] text-bg"
          >
            {t('accept')}
          </Link>
          <Link
            href="/auth/sign-in"
            className="text-center text-[13px] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {a('signIn')}
          </Link>
        </div>
      )}
    </div>
  );
}
