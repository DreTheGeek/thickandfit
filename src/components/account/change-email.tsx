'use client';
// Change email. Supabase "Secure email change" is NOT immediate: it confirms via BOTH the current
// and the new inbox, and the address only changes after confirmation. So a successful submit shows a
// PENDING state ("confirm via both inboxes"), never an instant change.
import { useActionState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { updateMyEmailAction, type AccountFormState } from '@/lib/account/actions';

const inputClass =
  'w-full border border-line bg-surface px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-faint focus:border-ink';

function errorMessage(t: ReturnType<typeof useTranslations>, code?: string): string | null {
  if (!code) return null;
  const known = ['invalidEmail', 'rateLimited', 'emailUpdateFailed'];
  return t(known.includes(code) ? `error.${code}` : 'error.generic');
}

export function ChangeEmail({ currentEmail }: { currentEmail: string }): ReactElement {
  const t = useTranslations('app.account');
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(
    updateMyEmailAction,
    {},
  );

  if (state.pending) {
    // Confirmation links are out; the change is not applied until both inboxes confirm.
    return (
      <div className="mt-3 border border-line p-4">
        <p className="text-[13px] leading-relaxed text-ink">{t('emailChangePending')}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t('currentEmailLabel', { email: currentEmail })}</p>
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder={t('newEmail')}
        className={inputClass}
      />
      <button
        type="submit"
        disabled={pending}
        className="tf-press w-full border border-line py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted disabled:opacity-60"
      >
        {pending ? '…' : t('changeEmailCta')}
      </button>
      {errorMessage(t, state.error) ? (
        <p className="text-[12px] text-alert">{errorMessage(t, state.error)}</p>
      ) : null}
    </form>
  );
}
