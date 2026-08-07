'use client';
// Email/password sign-in or sign-up. useActionState (React 19). States via pending/error/sent.
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
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
      {mode === 'sign-up' && (
        <div className="flex gap-3">
          <input
            name="firstName"
            type="text"
            required
            maxLength={60}
            autoComplete="given-name"
            placeholder={t('firstName')}
            className={inputClass}
          />
          <input
            name="lastName"
            type="text"
            required
            maxLength={60}
            autoComplete="family-name"
            placeholder={t('lastName')}
            className={inputClass}
          />
        </div>
      )}
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
        aria-describedby={mode === 'sign-up' ? 'password-hint' : undefined}
      />
      {/* Sign-up only. On sign-in the rule is irrelevant (she already has a password) and showing it
          there reads as a demand to change it. The rule is worth stating BEFORE she types, because
          the breach check is not a complexity rule and nothing about the field hints at it: an
          8-character password with a symbol in it still gets rejected if it has leaked somewhere. */}
      {mode === 'sign-up' && (
        <p id="password-hint" className="-mt-1 text-[12px] leading-[1.5] text-faint">
          {t('passwordHint')}
        </p>
      )}
      {state.error != null && (
        <p role="alert" className="bg-alert px-3 py-2 text-sm text-alert-ink">
          {state.error}
        </p>
      )}
      <Button type="submit" size="block" disabled={pending} className="mt-1">
        {pending ? '…' : mode === 'sign-in' ? t('signIn') : t('signUp')}
      </Button>
      {mode === 'sign-up' && (
        <p className="mt-1 text-center text-[12px] leading-[1.5] text-faint">
          {t.rich('agreeNotice', {
            terms: (chunks: ReactNode) => (
              <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
                {chunks}
              </Link>
            ),
            privacy: (chunks: ReactNode) => (
              <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}
    </form>
  );
}
