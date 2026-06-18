'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { requestResetAction, type AuthState } from '@/lib/auth/actions';

const inputClass =
  'w-full border border-neutral-200 bg-white px-4 py-3.5 text-base text-ink outline-none transition placeholder:text-neutral-400 focus:border-ink';
const btnClass =
  'w-full bg-olive px-6 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-black transition hover:bg-olive-600 disabled:cursor-not-allowed disabled:opacity-60';

export function ForgotForm() {
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState<AuthState, FormData>(requestResetAction, {});

  if (state.sent) {
    return (
      <p className="border-l-2 border-olive bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
        {t('resetSent')}
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
      <button type="submit" disabled={pending} className={btnClass}>
        {pending ? '…' : t('resetCta')}
      </button>
    </form>
  );
}
