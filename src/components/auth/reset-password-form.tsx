'use client';
// Completes a password reset. The recovery session is already established by the callback,
// so this just collects the new password (with confirm) and hands it to the server action.
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { updatePasswordAction, type AuthState } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';

const inputClass =
  'w-full border border-line bg-surface px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-faint focus:border-ink';

export function ResetPasswordForm(): ReactElement {
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updatePasswordAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder={t('newPassword')}
        className={inputClass}
      />
      <input
        name="confirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder={t('confirmPassword')}
        className={inputClass}
      />
      {state.error != null && (
        <p role="alert" className="bg-alert px-3 py-2 text-sm text-alert-ink">
          {state.error}
        </p>
      )}
      <Button type="submit" size="block" disabled={pending} className="mt-1">
        {pending ? '…' : t('updatePasswordCta')}
      </Button>
    </form>
  );
}
