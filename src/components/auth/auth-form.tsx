'use client';
// Email/password sign-in or sign-up. useActionState (React 19). Four states via pending/error/sent.
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { signInAction, signUpAction, type AuthState } from '@/lib/auth/actions';

const inputClass = 'rounded-none border border-black bg-white px-4 py-3 text-base';
const btnClass = 'rounded-none bg-black px-6 py-3 text-base font-medium text-white disabled:opacity-60';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const t = useTranslations('auth');
  const action = mode === 'sign-in' ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});

  if (mode === 'sign-up' && state.sent) {
    return <p className="text-sm text-neutral-600">{t('checkEmail')}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input name="email" type="email" required autoComplete="email" placeholder={t('email')} className={inputClass} />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        placeholder={t('password')}
        className={inputClass}
      />
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={btnClass}>
        {mode === 'sign-in' ? t('signIn') : t('signUp')}
      </button>
    </form>
  );
}
