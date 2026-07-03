'use client';
// Interactive billing controls. One-tap cancel = single confirm + an OPTIONAL reason. Reactivate
// is always offered. Start-checkout redirects to Stripe. No dark patterns, no retention friction.
import { useActionState, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import {
  startCheckoutAction,
  cancelSubscriptionAction,
  reactivateSubscriptionAction,
  type BillingState,
} from '@/lib/billing/actions';

type Props = {
  /** 'none' = no active sub (offer subscribe), 'active' = offer cancel, 'cancelling' = offer reactivate. */
  mode: 'none' | 'active' | 'cancelling';
};

const REASON_CODES = ['too_expensive', 'not_using', 'missing_feature', 'other'] as const;

function errorMessage(t: ReturnType<typeof useTranslations>, code?: string): string | null {
  if (!code) return null;
  const known = ['notConfigured', 'stripeError', 'noSubscription', 'noEmail', 'noCompany', 'rateLimited'];
  return t(known.includes(code) ? `error.${code}` : 'error.generic');
}

export function BillingActions({ mode }: Props): ReactElement {
  const t = useTranslations('app.billing');

  if (mode === 'cancelling') return <ReactivateButton t={t} />;
  if (mode === 'active') return <CancelFlow t={t} />;
  return <SubscribeButton t={t} />;
}

function SubscribeButton({ t }: { t: ReturnType<typeof useTranslations> }): ReactElement {
  const [state, formAction, pending] = useActionState<BillingState, FormData>(
    startCheckoutAction,
    {},
  );
  useEffect(() => {
    if (state.checkoutUrl) window.location.href = state.checkoutUrl;
  }, [state.checkoutUrl]);

  return (
    <form action={formAction} className="mt-2">
      <button
        type="submit"
        disabled={pending}
        className="tf-press w-full bg-accent py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-accent-ink disabled:opacity-60"
      >
        {pending ? '…' : t('subscribeCta')}
      </button>
      {/* Auto-renewal disclosure: clear and conspicuous, in visual proximity to the consent button
          (ROSCA + California ARL). Submitting subscribes you and is recorded as your consent. */}
      <p className="mt-2.5 text-[11px] leading-relaxed text-faint">{t('autoRenewDisclosure')}</p>
      {errorMessage(t, state.error) ? (
        <p className="mt-2 text-[12px] text-alert">{errorMessage(t, state.error)}</p>
      ) : null}
    </form>
  );
}

function ReactivateButton({ t }: { t: ReturnType<typeof useTranslations> }): ReactElement {
  const [state, formAction, pending] = useActionState<BillingState, FormData>(
    reactivateSubscriptionAction,
    {},
  );
  return (
    <form action={formAction} className="mt-2">
      <button
        type="submit"
        disabled={pending}
        className="tf-press w-full bg-accent py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-accent-ink disabled:opacity-60"
      >
        {pending ? '…' : t('reactivateCta')}
      </button>
      {errorMessage(t, state.error) ? (
        <p className="mt-2 text-[12px] text-alert">{errorMessage(t, state.error)}</p>
      ) : null}
    </form>
  );
}

function CancelFlow({ t }: { t: ReturnType<typeof useTranslations> }): ReactElement {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<BillingState, FormData>(
    cancelSubscriptionAction,
    {},
  );

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="tf-press mt-2 w-full border border-line py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
      >
        {t('cancelCta')}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <p className="text-[13px] text-soft">{t('cancelConfirm')}</p>

      {/* Optional reason. Clearly labeled optional; never blocks cancellation. */}
      <label className="text-[12px] uppercase tracking-[1.5px] text-faint">
        {t('reasonLabel')}
      </label>
      <select
        name="reasonCode"
        defaultValue=""
        className="w-full border border-line bg-surface px-3 py-3 text-[14px] text-ink outline-none focus:border-ink"
      >
        <option value="">{t('reasonNone')}</option>
        {REASON_CODES.map((code) => (
          <option key={code} value={code}>
            {t(`reason.${code}`)}
          </option>
        ))}
      </select>
      <textarea
        name="reasonText"
        rows={2}
        placeholder={t('reasonPlaceholder')}
        className="w-full resize-none border border-line bg-surface px-3 py-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="tf-press flex-1 border border-line py-3 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
        >
          {t('keepPlan')}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="tf-press flex-1 bg-alert py-3 text-[12px] font-semibold uppercase tracking-[2px] text-alert-ink disabled:opacity-60"
        >
          {pending ? '…' : t('confirmCancel')}
        </button>
      </div>
      {errorMessage(t, state.error) ? (
        <p className="text-[12px] text-alert">{errorMessage(t, state.error)}</p>
      ) : null}
    </form>
  );
}
