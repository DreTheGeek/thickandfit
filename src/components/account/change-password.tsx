'use client';
// In-app password change. Requires the current password (defense-in-depth: a stolen session cannot
// silently lock out the owner). On success shows a confirmation; the session stays valid.
import { useActionState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { updateMyPasswordAction, type AccountFormState } from '@/lib/account/actions';

const inputClass =
  'w-full border border-line bg-surface px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-faint focus:border-ink';

function errorMessage(t: ReturnType<typeof useTranslations>, code?: string): string | null {
  if (!code) return null;
  const known = [
    'invalidPassword',
    'passwordMismatch',
    'rateLimited',
    'passwordUpdateFailed',
  ];
  return t(known.includes(code) ? `error.${code}` : 'error.generic');
}

export function ChangePassword(): ReactElement {
  const t = useTranslations('app.account');
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(
    updateMyPasswordAction,
    {},
  );

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <input
        name="currentPassword"
        type="password"
        required
        autoComplete="current-password"
        placeholder={t('currentPassword')}
        className={inputClass}
      />
      <input
        name="newPassword"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder={t('newPassword')}
        className={inputClass}
      />
      <input
        name="confirmPassword"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder={t('confirmPassword')}
        className={inputClass}
      />
      <button
        type="submit"
        disabled={pending}
        className="tf-press w-full bg-ink py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-bg disabled:opacity-60"
      >
        {pending ? '…' : t('changePasswordCta')}
      </button>
      {state.ok ? (
        <p className="text-[12px] text-accent">{t('passwordChanged')}</p>
      ) : null}
      {errorMessage(t, state.error) ? (
        <p className="text-[12px] text-alert">{errorMessage(t, state.error)}</p>
      ) : null}
    </form>
  );
}
