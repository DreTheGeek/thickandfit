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
import type { CheckoutTier } from '@/lib/billing/tiers';

type Props = {
  /** 'none' = no active sub (offer subscribe), 'active' = offer cancel, 'cancelling' = offer
   *  reactivate, 'pastDue' = her card failed, so the ONLY thing that helps is replacing it. */
  mode: 'none' | 'active' | 'cancelling' | 'pastDue';
  /** The member's chosen self-serve tier, passed through to checkout so the right price is used. */
  tier?: CheckoutTier;
  /** Show the card-update button alongside whatever else this mode offers. */
  canUpdateCard?: boolean;
};

const REASON_CODES = ['too_expensive', 'not_using', 'missing_feature', 'other'] as const;

function errorMessage(t: ReturnType<typeof useTranslations>, code?: string): string | null {
  if (!code) return null;
  const known = ['notConfigured', 'stripeError', 'noSubscription', 'noEmail', 'noCompany', 'rateLimited', 'salesAssisted', 'alreadySubscribed'];
  return t(known.includes(code) ? `error.${code}` : 'error.generic');
}

export function BillingActions({ mode, tier, canUpdateCard }: Props): ReactElement {
  const t = useTranslations('app.billing');

  // past_due comes FIRST. Previously this state fell into 'active' (isActiveStatus includes
  // past_due) and the only control she was offered was Cancel — on the screen she reached because
  // her payment failed. Cancel is still reachable below the fold; it is just no longer the answer
  // the page leads with.
  if (mode === 'pastDue') {
    return (
      <div className="mt-2 flex flex-col gap-3">
        <UpdateCardButton t={t} primary />
        <CancelFlow t={t} />
      </div>
    );
  }
  if (mode === 'cancelling') {
    return (
      <div className="mt-2 flex flex-col gap-3">
        <ReactivateButton t={t} />
        {canUpdateCard ? <UpdateCardButton t={t} /> : null}
      </div>
    );
  }
  if (mode === 'active') {
    return (
      <div className="mt-2 flex flex-col gap-3">
        {canUpdateCard ? <UpdateCardButton t={t} /> : null}
        <CancelFlow t={t} />
      </div>
    );
  }
  return <SubscribeButton t={t} tier={tier} />;
}

/**
 * Opens a Stripe-hosted billing portal session.
 *
 * A fetch + redirect rather than a server action, because the portal URL is single-use and
 * short-lived: minting it on render (or on a form POST that React may replay) risks handing her a
 * consumed link. She clicks, we mint, she goes.
 */
function UpdateCardButton({
  t,
  primary,
}: {
  t: ReturnType<typeof useTranslations>;
  primary?: boolean;
}): ReactElement {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const body = (await res.json()) as { ok?: boolean; url?: string };
      if (!res.ok || !body.url) {
        setError(t('error.portalFailed'));
        setPending(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError(t('error.portalFailed'));
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className={
          primary
            ? 'tf-press w-full bg-accent py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-accent-ink disabled:opacity-60'
            : 'tf-press w-full border border-line py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted disabled:opacity-60'
        }
      >
        {pending ? '…' : t('updateCardCta')}
      </button>
      {error ? <p className="mt-2 text-[12px] text-alert">{error}</p> : null}
    </div>
  );
}

function SubscribeButton({ t, tier }: { t: ReturnType<typeof useTranslations>; tier?: CheckoutTier }): ReactElement {
  const [state, formAction, pending] = useActionState<BillingState, FormData>(
    startCheckoutAction,
    {},
  );
  useEffect(() => {
    if (state.checkoutUrl) window.location.href = state.checkoutUrl;
  }, [state.checkoutUrl]);

  return (
    <form action={formAction} className="mt-2">
      {tier ? <input type="hidden" name="tier" value={tier} /> : null}
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
        <div className="mt-2">
          <p className="text-[12px] text-alert">{errorMessage(t, state.error)}</p>
          {/* The one error with an obvious next step. Telling a member she is already subscribed and
              leaving her on the subscribe button is how she tries again, and again. */}
          {state.error === 'alreadySubscribed' ? (
            <a
              href="/account/billing?fix=card"
              className="mt-1 inline-block text-[12px] font-semibold text-accent underline"
            >
              {t('updateCardCta')}
            </a>
          ) : null}
        </div>
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
    <form action={formAction}>
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
        className="tf-press w-full border border-line py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
      >
        {t('cancelCta')}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
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
