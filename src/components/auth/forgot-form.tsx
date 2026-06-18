'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { requestResetAction, type AuthState } from '@/lib/auth/actions';

export function ForgotForm() {
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState<AuthState, FormData>(requestResetAction, {});

  if (state.sent) {
    return <p className="text-sm text-neutral-600">{t('resetSent')}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder={t('email')}
        className="rounded-none border border-black bg-white px-4 py-3 text-base"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-none bg-black px-6 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {t('resetCta')}
      </button>
    </form>
  );
}
