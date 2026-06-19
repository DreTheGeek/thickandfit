'use client';
// Email/password sign-in or sign-up. useActionState (React 19). States via pending/error/sent.
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { signInAction, signUpAction, type AuthState } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';

const inputClass =
  'w-full border border-line bg-surface px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-faint focus:border-ink';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }): ReactElement {
  const t = useTranslations('auth');
  const action = mode === 'sign-in' ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});

  if (mode === 'sign-up' && state.sent) {
    return (
      <p className="rounded-xl bg-warm px-4 py-3 text-sm text-soft">{t('checkEmail')}</p>
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
      {state.error != null && (
        <p role="alert" className="bg-alert px-3 py-2 text-sm text-alert-ink">
          {state.error}
        </p>
      )}
      <Button type="submit" size="block" disabled={pending} className="mt-1">
        {pending ? '…' : mode === 'sign-in' ? t('signIn') : t('signUp')}
      </Button>
    </form>
  );
}
