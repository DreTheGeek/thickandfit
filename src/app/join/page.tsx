// The Libra Season waitlist landing (Aug 4 → Sept 27 doors). Public + crawlable.
//
// Resolves the ?r=<code> referrer server-side so the friend's name shows in the hero without a
// client round-trip, and sets a first-party cookie so the credit still fires after a bounce and
// return. Copy is app-focused per the 2026-07-23 call ("Thick & Fit brand, not personal brand"),
// but Stephanie's photo carries the hero. Bilingual through the funnel namespace; the /es twin
// re-exports this file.
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { getUiLocale } from '@/lib/i18n/locale';
import { localeAlternates } from '@/lib/seo/locale-alternates';
import { findLeadByReferralCode } from '@/lib/funnel/service';
import { WaitlistFunnelForm } from '@/components/funnel/waitlist-funnel-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('funnel');
  return {
    title: `${t('cta')} · Thick & Fit`,
    description: t('landingSubhead'),
    alternates: await localeAlternates('/join'),
    openGraph: {
      url: '/join',
      title: `${t('cta')} · Thick & Fit`,
      description: t('landingSubhead'),
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const t = await getTranslations('funnel');
  const locale = await getUiLocale();
  const sp = await searchParams;

  // Prefer the URL param (a fresh referral click) over the cookie (a returning visitor); if only
  // the cookie is set, still credit them. Downcase for the DB lookup (referral_code is lower).
  const cookieRef = (await cookies()).get('funnel_ref_incoming')?.value ?? null;
  const raw = typeof sp.r === 'string' ? sp.r : Array.isArray(sp.r) ? sp.r[0] : null;
  const code = (raw ?? cookieRef ?? '').trim().toLowerCase() || null;

  // Server-resolve so the friend's real first name shows without a client fetch.
  // A stale/typo'd code just falls through; we still let the form load.
  const referrer = code ? await findLeadByReferralCode(code) : null;
  const invalidReferral = code !== null && referrer === null;

  return (
    <main className="min-h-screen bg-[#0e0e0e] text-white">
      <section className="relative isolate overflow-hidden">
        {/* Photo hero: her, not a UI card. Same shoot as the marketing home so the visual
            through-line from / → /join stays intact. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/shoot/pink-front.avif"
          alt="Coach Stephanie Pantoja"
          className="absolute inset-0 hidden h-full w-full object-cover object-[62%_18%] lg:block"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/shoot/pink-front.avif"
          alt="Coach Stephanie Pantoja"
          className="absolute inset-0 h-[62svh] w-full object-cover object-[52%_16%] lg:hidden"
        />
        {/* Scrim so type stays readable over the photo. Right-weighted on desktop, top-to-bottom on mobile. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/30 lg:hidden"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden lg:block lg:bg-[linear-gradient(to_left,rgba(8,8,8,0.92)_0%,rgba(8,8,8,0.82)_36%,rgba(8,8,8,0.35)_62%,rgba(8,8,8,0.05)_100%)]"
        />

        <div className="relative z-10 mx-auto grid min-h-[86svh] w-full max-w-[1340px] grid-cols-1 items-end gap-8 px-5 pb-14 pt-24 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-24">
          {/* Left: the promise. Below the fold on mobile because the photo is the hook. */}
          <div className="text-left lg:pr-8">
            <p className="text-[13px] font-bold uppercase leading-tight tracking-[0.18em] text-[#ff2d55]">
              {t('eyebrow')}
            </p>
            <h1 className="mt-4 text-[40px] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] text-white sm:text-[52px] lg:text-[60px]">
              {t('landingHeadline')}
            </h1>
            <p className="mt-5 max-w-[52ch] text-[16px] leading-snug text-white/85 sm:text-[18px]">
              {t('landingSubhead')}
            </p>
            {referrer && (
              <p className="mt-6 rounded-md border border-white/15 bg-black/40 px-4 py-3 text-[14px] leading-snug text-white">
                {t('referredBy', { name: (referrer.first_name ?? '').trim() || '—' })}
              </p>
            )}
            {invalidReferral && (
              <p className="mt-6 rounded-md border border-white/10 bg-black/30 px-4 py-3 text-[13px] leading-snug text-white/70">
                {t('invalidReferral')}
              </p>
            )}
          </div>

          {/* Right: the form. Above the fold on desktop. */}
          <div className="rounded-2xl bg-black/45 p-6 backdrop-blur-sm sm:p-8 lg:bg-black/25 lg:p-10 lg:backdrop-blur-md">
            <WaitlistFunnelForm locale={locale} referredByCode={code} />
          </div>
        </div>
      </section>
    </main>
  );
}
