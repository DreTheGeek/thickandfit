'use client';
// Google + Apple. Server action builds the provider redirect (needs provider config in Supabase).
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { signInWithOAuthAction } from '@/lib/auth/actions';

const btnClass = 'rounded-none border border-black bg-white px-6 py-3 text-base font-medium disabled:opacity-60';

export function OAuthButtons() {
  const t = useTranslations('auth');
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={pending} onClick={() => start(() => signInWithOAuthAction('google'))} className={btnClass}>
        {t('continueGoogle')}
      </button>
      <button type="button" disabled={pending} onClick={() => start(() => signInWithOAuthAction('apple'))} className={btnClass}>
        {t('continueApple')}
      </button>
    </div>
  );
}
