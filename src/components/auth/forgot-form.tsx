'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { requestResetAction, type AuthState } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';

const inputClass =
  'w-full border border-line bg-surface px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-faint focus:border-ink';

export function ForgotForm(): ReactElement {
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState<AuthState, FormData>(requestResetAction, {});

  if (state.sent) {
    return <p className="rounded-xl bg-warm px-4 py-3 text-sm text-soft">{t('resetSent')}</p>;
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
      <Button type="submit" size="block" disabled={pending} className="mt-1">
        {pending ? '…' : t('resetCta')}
      </Button>
    </form>
  );
}
