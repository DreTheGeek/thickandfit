'use client';
// The Libra Season waitlist signup form (2026-07-23 launch call, Aug 4 → doors open in October).
//
// Reads a first-party ?r=<code> cookie set by the page (see /join server component) so the
// referral chain works even when a friend clicks the link, closes the tab, and comes back later.
// On success, sets a `funnel_lead` cookie (leadId + referralCode) so the thank-you page renders
// server-side without needing the id in the URL, then redirects to /join/thanks. IG handle is
// required per the launch spec ("must have Instagram to enter"); every other field validates on
// blur so the CTA is not a mystery box of errors.
import { useMemo, useState, useCallback, type FormEvent, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TurnstileWidget } from '@/components/funnel/turnstile-widget';

// Public site key baked at build time. Absent = no widget rendered (server verify also skips,
// the two are kept in sync via the same "unset means bypass" convention across the app).
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

type Status = 'idle' | 'submitting' | 'error';

// Trim leading @ and anything a mobile keyboard might auto-add. Keeps IG handles clean for tagging.
function normalizeInstagram(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/\s+/g, '');
}

// Minimal IG validator: letters, digits, dot, underscore, 1 to 30 chars per IG's own rule.
function isValidInstagram(raw: string): boolean {
  const h = normalizeInstagram(raw);
  return /^[A-Za-z0-9._]{1,30}$/.test(h);
}

export function WaitlistFunnelForm({
  locale,
  referredByCode,
}: {
  locale: 'en' | 'es';
  referredByCode: string | null;
}): ReactElement {
  const t = useTranslations('funnel');
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [lang, setLang] = useState<'en' | 'es'>(locale);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Turnstile challenge response. Null when the widget hasn't solved yet OR when Turnstile isn't
  // configured (site key unset: widget renders nothing and the server verify layer skips too).
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const onTurnstileToken = useCallback((t: string | null) => setTurnstileToken(t), []);
  const turnstileConfigured = TURNSTILE_SITE_KEY.length > 0;

  const canSubmit = useMemo(() => {
    const baseValid =
      status !== 'submitting' &&
      firstName.trim().length > 0 &&
      email.trim().length > 3 &&
      isValidInstagram(instagram);
    // Only gate on the Turnstile token when Turnstile is actually enabled; otherwise a pre-config
    // deploy would strand every user with a permanently-disabled CTA.
    if (!baseValid) return false;
    if (turnstileConfigured && !turnstileToken) return false;
    return true;
  }, [status, firstName, email, instagram, turnstileConfigured, turnstileToken]);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus('submitting');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/funnel/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          instagram_handle: normalizeInstagram(instagram),
          locale: lang,
          referred_by_code: referredByCode || undefined,
          source: 'waitlist-form',
          turnstile_token: turnstileToken || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true; data: { leadId: string; referralCode: string; entryCount: number; isNew: boolean } }
        | { ok: false; error: string }
        | null;

      if (res.status === 429) {
        setStatus('error');
        setErrorMessage(t('rateLimited'));
        return;
      }
      if (!res.ok || !body || !('ok' in body) || !body.ok) {
        setStatus('error');
        setErrorMessage(t('genericError'));
        return;
      }

      // Persist the lead identity in a first-party cookie so the thank-you page renders without
      // exposing the leadId in the URL. 60 days is generous: the campaign is ~8 weeks.
      const maxAge = 60 * 60 * 24 * 60; // 60d
      document.cookie = `funnel_lead=${encodeURIComponent(body.data.leadId)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
      document.cookie = `funnel_ref=${encodeURIComponent(body.data.referralCode)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;

      router.push(`/join/thanks`);
    } catch {
      setStatus('error');
      setErrorMessage(t('genericError'));
    }
  }

  const inputCls =
    'w-full rounded-md border border-white/15 bg-black/40 px-4 py-3 text-[15px] text-white placeholder:text-white/40 outline-none focus:border-[#ff2d55]';
  const labelCls = 'block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70';
  // Optional fields carried no marker at all, so next to three fields ending in "*" they read as
  // required and people bounced rather than leave one blank. The badge is the counterpart to the "*".
  const optionalCls =
    'ml-2 text-[10px] font-medium normal-case tracking-[0.06em] text-white/45';
  const helpCls = 'text-[12px] leading-relaxed text-white/55';

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="mx-auto w-full max-w-[560px]">
      <h2 className="mb-5 text-[16px] font-bold uppercase tracking-[0.14em] text-white">
        {t('formTitle')}
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t('firstName')} *</span>
          <input
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>
            {t('lastName')}
            <span className={optionalCls}>{t('optional')}</span>
          </span>
          <input
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className={labelCls}>{t('email')} *</span>
        <input
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </label>

      {/* TCPA: we cannot text a number collected without disclosed consent. The line has to be at
          the point of collection, has to say the number is optional and not a condition of joining,
          has to name the message types and that rates apply, and has to publish the STOP keyword.
          Moving or trimming it is a legal change, not a copy change. */}
      <label className="mt-4 flex flex-col gap-1.5">
        <span className={labelCls}>
          {t('phone')}
          <span className={optionalCls}>{t('optional')}</span>
        </span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputCls}
        />
        <span className={helpCls}>{t('phoneConsent')}</span>
      </label>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className={labelCls}>{t('instagram')} *</span>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/50"
          >
            @
          </span>
          <input
            type="text"
            required
            autoComplete="off"
            spellCheck={false}
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="stephsblessedd"
            className={`${inputCls} pl-9`}
          />
        </div>
        <span className={helpCls}>{t('instagramHelp')}</span>
      </label>

      <fieldset className="mt-5">
        <legend className={`${labelCls} mb-2`}>{t('language')}</legend>
        <div className="flex gap-2">
          {(['en', 'es'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={[
                'rounded-full border px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.12em]',
                lang === code
                  ? 'border-[#ff2d55] bg-[#ff2d55] text-[#0e0e0e]'
                  : 'border-white/20 bg-transparent text-white/80',
              ].join(' ')}
            >
              {code === 'en' ? t('languageEn') : t('languageEs')}
            </button>
          ))}
        </div>
      </fieldset>

      {turnstileConfigured && (
        <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} locale={lang} onToken={onTurnstileToken} />
      )}

      {status === 'error' && errorMessage && (
        <p
          role="alert"
          className="mt-5 rounded-md border border-[#ff2d55]/50 bg-[#ff2d55]/10 px-4 py-3 text-[14px] text-white"
        >
          {errorMessage}
        </p>
      )}

      {/* The page sells a $19.97 founding price, so the button reads like a checkout unless we say
          otherwise right where the thumb is. Free, no card, no charge today. */}
      <p className="mt-6 text-center text-[13px] leading-relaxed text-white/75">
        {t('freeReassurance')}
      </p>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-3 block w-full rounded-full bg-[#ff2d55] px-9 py-4 text-center text-[15px] font-bold uppercase tracking-[0.02em] text-[#0e0e0e] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'submitting' ? t('submitting') : t('cta')}
      </button>

      <p className="mt-4 text-[12px] leading-relaxed text-white/60">{t('fineprint')}</p>
      {/* Replaces the old `footerLegal`, which put "US residents 18+" on the WAITLIST and told half
          the audience (Latin America) they were not invited. Only the giveaway is restricted. */}
      <p className="mt-3 text-[11px] leading-relaxed text-white/40">{t('giveawayEligibility')}</p>
    </form>
  );
}
