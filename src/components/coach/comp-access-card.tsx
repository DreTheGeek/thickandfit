'use client';
// Coach control for comped access on the subscriber profile: grant 7/30/90 or custom days, or revoke.
// The grant/revoke backend predates this card; this is the first (and only) UI caller.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { grantCompAction, revokeCompAction } from '@/lib/billing/comp-actions';

const PRESETS = [7, 30, 90] as const;

export function CompAccessCard({
  profileId,
  compUntil,
  active,
}: {
  profileId: string;
  compUntil: string | null;
  /** Whether the comp is currently live; computed on the server (client render must stay pure). */
  active: boolean;
}): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState('');
  const [error, setError] = useState(false);

  function grant(days: number): void {
    if (!Number.isFinite(days) || days < 1) return;
    setError(false);
    startTransition(async () => {
      const res = await grantCompAction({ profileId, days: Math.floor(days) });
      if (!res.ok) setError(true);
      else {
        setCustom('');
        router.refresh();
      }
    });
  }

  function revoke(): void {
    if (!window.confirm(t('compRevokeConfirm'))) return;
    setError(false);
    startTransition(async () => {
      const res = await revokeCompAction(profileId);
      if (!res.ok) setError(true);
      else router.refresh();
    });
  }

  return (
    <div>
      {active ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[14px]">
            {t('compActiveUntil', { date: new Date(compUntil as string).toLocaleDateString() })}
          </span>
          <button
            type="button"
            onClick={revoke}
            disabled={pending}
            className="tf-press rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold text-alert-ink disabled:opacity-50"
          >
            {t('compRevoke')}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => grant(d)}
              disabled={pending}
              className="tf-press rounded-full border border-ink px-3.5 py-1.5 text-[12px] font-semibold disabled:opacity-50"
            >
              {t('compGrantDays', { n: d })}
            </button>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="365"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={t('compCustomDays')}
              aria-label={t('compCustomDays')}
              className="w-24 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-[13px] outline-none placeholder:text-faint focus:border-ink"
            />
            <button
              type="button"
              onClick={() => grant(Number(custom))}
              disabled={pending || !(Number(custom) >= 1)}
              className="tf-press rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-bg disabled:opacity-40"
            >
              {t('compGrantCta')}
            </button>
          </span>
        </div>
      )}
      <p className="mt-2 text-[12px] text-faint">{t('compHint')}</p>
      {error && <p className="mt-1 text-[12px] text-alert-ink">{t('compError')}</p>}
    </div>
  );
}
