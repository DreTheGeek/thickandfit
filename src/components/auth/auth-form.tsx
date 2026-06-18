'use client';
// Email/password sign-in or sign-up. useActionState (React 19). Four states via pending/error/sent.
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { signInAction, signUpAction, type AuthState } from '@/lib/auth/actions';

const inputClass =
  'w-full border border-neutral-200 bg-white px-4 py-3.5 text-base text-ink outline-none transition placeholder:text-neutral-400 focus:border-ink';
const btnClass =
  'w-full bg-olive px-6 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-black transition hover:bg-olive-600 disabled:cursor-not-allowed disabled:opacity-60';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const t = useTranslations('auth');
  const action = mode === 'sign-in' ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});

  if (mode === 'sign-up' && state.sent) {
    return (
      <p className="border-l-2 border-olive bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
        {t('checkEmail')}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder={t('email')}
        className={inputClass}
      />
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
        <p role="alert" className="border-l-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={btnClass}>
        {pending ? '…' : mode === 'sign-in' ? t('signIn') : t('signUp')}
      </button>
    </form>
  );
}
