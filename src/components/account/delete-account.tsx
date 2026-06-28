'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { deleteAccountAction } from '@/lib/account/actions';

// Two-step, irreversible account deletion (GDPR/CCPA erasure). The action deletes the auth user and
// cascades all owned data, then signs out.
export function DeleteAccount(): ReactElement {
  const t = useTranslations('app');
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="tf-press mt-3 w-full border border-red-300 py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-red-600"
      >
        {t('account.deleteAccount')}
      </button>
    );
  }

  return (
    <div className="mt-3 border border-red-300 p-4">
      <p className="text-[13px] leading-relaxed text-ink">{t('account.deleteConfirmBody')}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void deleteAccountAction())}
          className="tf-press flex-1 bg-red-600 py-2.5 text-[12px] font-semibold uppercase tracking-[2px] text-white disabled:opacity-50"
        >
          {pending ? t('account.deleting') : t('account.deleteConfirmCta')}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="tf-press border border-line px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
