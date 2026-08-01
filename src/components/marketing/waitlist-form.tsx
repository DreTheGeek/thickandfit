'use client';
// Waitlist capture form. Four states: idle, loading, error, success (UI-states standard).
import { useState } from 'react';
import { TurnstileWidget } from '@/components/funnel/turnstile-widget';
import { useTranslations } from 'next-intl';

type FormState = 'idle' | 'loading' | 'error' | 'success';

export function WaitlistForm({ locale }: { locale: string }) {
  const t = useTranslations('waitlist');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  // Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so this form is unchanged today and
  // starts carrying a token the moment the key lands. The server gate is what actually blocks.
  const [token, setToken] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale, source: 'join', turnstile_token: token ?? undefined }),
      });
      setState(res.ok ? 'success' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    // Success state: green here is the sanctioned FUNCTIONAL use, via the accent token rather than a
    // hardcoded hex (which was rebrand residue).
    return (
      <div className="border-l-2 border-accent pl-4">
        <h2 className="text-xl font-semibold">{t('successTitle')}</h2>
        <p className="mt-1 text-sm text-neutral-600">{t('successBody')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('emailPlaceholder')}
        className="flex-1 rounded-none border border-black bg-white px-4 py-3 text-base"
      />
      <button
        type="submit"
        disabled={state === 'loading'}
        className="rounded-none bg-black px-6 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {state === 'loading' ? t('submitting') : t('cta')}
      </button>
      {/* sm:basis-full so the challenge sits on its own row rather than squeezing the inline
          email + button layout. Renders nothing until the site key is configured. */}
      <div className="sm:basis-full">
        <TurnstileWidget
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''}
          locale={locale === 'es' ? 'es' : 'en'}
          onToken={setToken}
        />
      </div>
      {state === 'error' ? (
        <p role="alert" className="text-sm text-alert-ink sm:basis-full">
          {t('error')}
        </p>
      ) : null}
    </form>
  );
}
