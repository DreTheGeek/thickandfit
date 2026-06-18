'use client';
// Waitlist capture form. Four states: idle, loading, error, success (UI-states standard).
import { useState } from 'react';
import { useTranslations } from 'next-intl';

type FormState = 'idle' | 'loading' | 'error' | 'success';

export function WaitlistForm({ locale }: { locale: string }) {
  const t = useTranslations('waitlist');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale, source: 'join' }),
      });
      setState(res.ok ? 'success' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="border-l-2 border-[#5EBE62] pl-4">
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
      {state === 'error' ? (
        <p role="alert" className="text-sm text-red-600 sm:basis-full">
          {t('error')}
        </p>
      ) : null}
    </form>
  );
}
