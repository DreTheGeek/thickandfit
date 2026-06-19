'use client';
// Google + Apple. Server action builds the provider redirect (needs provider config in Supabase).
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { signInWithOAuthAction } from '@/lib/auth/actions';

const btnClass =
  'tf-press flex w-full items-center justify-center gap-2 border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink disabled:opacity-60';

export function OAuthButtons(): ReactElement {
  const t = useTranslations('auth');
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => signInWithOAuthAction('google'))}
        className={btnClass}
      >
        {t('continueGoogle')}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => signInWithOAuthAction('apple'))}
        className={btnClass}
      >
        {t('continueApple')}
      </button>
    </div>
  );
}
