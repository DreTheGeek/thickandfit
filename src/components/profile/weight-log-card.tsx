'use client';

// Weight entry card for the You screen. Subscriber types a weight, picks lb/kg, logs it.
// Writes via logWeightAction -> weight_entries (feeds the AI coach context + the goal ring).
import { useState, useTransition, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { logWeightAction } from '@/lib/coach-ai/weight-actions';

type Unit = 'lb' | 'kg';

export function WeightLogCard({
  latestLb,
  recordedOn,
}: {
  latestLb: number | null;
  recordedOn: string | null;
}): ReactElement {
  const t = useTranslations('app.you');
  const locale = useLocale();
  // The stored value is a plain calendar date (recorded_on is a DATE column, no time, no zone), so
  // it is formatted in UTC on purpose. Parsing "2026-07-01" as a local instant shifts it a day
  // backwards for anyone west of Greenwich, which would show a member the wrong day for her own
  // weigh-in.
  const recordedLabel = recordedOn
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${recordedOn}T00:00:00Z`),
      )
    : '';
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<Unit>('lb');
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    const weight = Number(value);
    if (!Number.isFinite(weight) || weight <= 0) {
      setStatus('error');
      return;
    }
    setStatus('idle');
    startTransition(async () => {
      const res = await logWeightAction({ weight, unit });
      if (res.ok) {
        setStatus('ok');
        setValue('');
      } else {
        setStatus('error');
      }
    });
  }

  return (
    <Card className="mb-[22px] p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[2px] text-muted">
          {t('logWeight')}
        </span>
        {latestLb != null && (
          <span className="text-[11px] text-faint">
            {t('lastLogged', { weight: `${latestLb} lb`, date: recordedLabel })}
          </span>
        )}
      </div>

      <form onSubmit={submit} className="flex items-stretch gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          placeholder={t('weightPlaceholder')}
          aria-label={t('logWeight')}
          className="min-w-0 flex-1 border border-line bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-ink"
        />
        <div className="flex border border-line">
          {(['lb', 'kg'] as Unit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              aria-pressed={unit === u}
              className={`tf-press px-3 text-[12px] font-semibold uppercase ${
                unit === u ? 'bg-ink text-bg' : 'text-muted'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={pending || value.trim() === ''}
          className="tf-press border border-ink bg-ink px-4 text-[12px] font-semibold uppercase tracking-[1px] text-bg disabled:opacity-50"
        >
          {pending ? t('saving') : t('save')}
        </button>
      </form>

      {status === 'ok' && (
        <p className="mt-2 text-[12px] text-accent">{t('weightSaved')}</p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-[12px] text-alert-ink">{t('weightError')}</p>
      )}
    </Card>
  );
}
