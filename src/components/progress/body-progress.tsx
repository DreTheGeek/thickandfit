'use client';

// The "Body" tab of /progress: weight trend + goal, a trailing 4-week recap (workouts, nutrition
// days, weight moved), and the measurement log (latest per site + change since start). All data is
// fetched server-side (getBodyStats); logging goes through server actions then router.refresh().
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { WeightTrendChart } from '@/components/progress/weight-trend-chart';
import { logWeightAction } from '@/lib/coach-ai/weight-actions';
import { logMeasurementAction } from '@/lib/body/actions';
import { MEASURE_FIELDS, type BodyStats, type MeasureField } from '@/lib/body/types';

const CM_TO_IN = 1 / 2.54;
type WeightUnit = 'lb' | 'kg';
type LenUnit = 'cm' | 'in';

export function BodyProgress({ body }: { body: BodyStats }): ReactElement {
  const t = useTranslations('app.progress');
  const locale = useLocale();

  const sinceStart =
    body.currentLb != null && body.startLb != null
      ? Math.round((body.currentLb - body.startLb) * 10) / 10
      : null;

  return (
    <div>
      {/* Weight headline + trend */}
      <Card className="mb-4 p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
              {t('currentWeight')}
            </div>
            <div className="font-display text-[40px] leading-none">
              {body.currentLb != null ? body.currentLb : '--'}
              <span className="ml-1 text-[15px] text-muted">lb</span>
            </div>
            {sinceStart != null && sinceStart !== 0 && (
              <div className={`mt-1 text-[12px] ${sinceStart < 0 ? 'text-accent' : 'text-muted'}`}>
                {t('sinceStart', { delta: `${sinceStart > 0 ? '+' : ''}${sinceStart}` })}
              </div>
            )}
          </div>
          {body.goalLb != null && (
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
                {t('goalWeight')}
              </div>
              <div className="font-display text-[24px] leading-none text-muted">
                {body.goalLb}
                <span className="ml-1 text-[13px]">lb</span>
              </div>
            </div>
          )}
        </div>

        {body.weightSeries.length >= 1 ? (
          <div className="mt-4">
            <WeightTrendChart series={body.weightSeries} goalLb={body.goalLb} goalLabel={t('goalWeight')} />
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-faint">{t('noWeightYet')}</p>
        )}

        <WeightQuickLog />
      </Card>

      {/* Weekly recap */}
      <div className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[2px] text-faint">
        {t('weeklyTitle')}
      </div>
      <Card className="mb-4 divide-y divide-divider p-0">
        {body.rollups.map((r, i) => (
          <div key={r.startOn} className="flex items-center justify-between px-4 py-3">
            <div className="text-[13px] font-semibold">
              {i === 0 ? t('thisWeek') : weekLabel(r.startOn, r.endOn, locale)}
            </div>
            <div className="flex items-center gap-4 text-right">
              <Stat label={t('weekWorkouts')} value={String(r.workouts)} />
              <Stat label={t('weekDays')} value={String(r.daysLogged)} />
              <Stat
                label={t('weekWeight')}
                value={r.weightDeltaLb == null ? '--' : `${r.weightDeltaLb > 0 ? '+' : ''}${r.weightDeltaLb}`}
                accent={r.weightDeltaLb != null && r.weightDeltaLb < 0}
              />
            </div>
          </div>
        ))}
      </Card>

      {/* Measurements */}
      <div className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[2px] text-faint">
        {t('measureTitle')}
      </div>
      <Measurements body={body} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}): ReactElement {
  return (
    <div className="min-w-[46px]">
      <div className={`font-display text-[18px] leading-none ${accent ? 'text-accent' : ''}`}>{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[1px] text-faint">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Weight quick-log (canonical kg via logWeightAction; refresh re-pulls the trend).
// ---------------------------------------------------------------------------------------------
function WeightQuickLog(): ReactElement {
  const t = useTranslations('app.progress');
  const router = useRouter();
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('lb');
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    const weight = Number(value);
    if (!Number.isFinite(weight) || weight <= 0) {
      setStatus('error');
      return;
    }
    setStatus('idle');
    start(async () => {
      const res = await logWeightAction({ weight, unit });
      if (res.ok) {
        setValue('');
        setStatus('ok');
        router.refresh();
      } else {
        setStatus('error');
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 flex items-stretch gap-2">
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
        {(['lb', 'kg'] as WeightUnit[]).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setUnit(u)}
            aria-pressed={unit === u}
            className={`tf-press px-3 text-[12px] font-semibold uppercase ${unit === u ? 'bg-ink text-bg' : 'text-muted'}`}
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
        {pending ? t('saving') : t('logWeight')}
      </button>
      {status === 'error' && <span className="self-center text-[12px] text-red-600">{t('weightError')}</span>}
    </form>
  );
}

// ---------------------------------------------------------------------------------------------
// Measurements: latest per site (+ change since start) and a collapsible multi-field log form.
// ---------------------------------------------------------------------------------------------
function Measurements({ body }: { body: BodyStats }): ReactElement {
  const t = useTranslations('app.progress');
  const locale = useLocale();
  const router = useRouter();
  const [displayUnit, setDisplayUnit] = useState<LenUnit>(locale === 'es' ? 'cm' : 'in');
  const [open, setOpen] = useState(false);

  const hasAny = body.measurements.some((m) => m.latest != null);

  function fmt(field: MeasureField, val: number): string {
    if (field === 'bodyFat') return `${val}%`;
    return displayUnit === 'in' ? `${Math.round(val * CM_TO_IN * 10) / 10} in` : `${val} cm`;
  }
  function fmtDelta(field: MeasureField, delta: number): string {
    if (field === 'bodyFat') return `${delta > 0 ? '+' : ''}${delta}%`;
    const v = displayUnit === 'in' ? Math.round(delta * CM_TO_IN * 10) / 10 : delta;
    return `${v > 0 ? '+' : ''}${v} ${displayUnit}`;
  }

  return (
    <>
      {hasAny ? (
        <Card className="mb-4 p-4">
          <div className="mb-3 flex justify-end">
            <div className="flex border border-line">
              {(['in', 'cm'] as LenUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setDisplayUnit(u)}
                  aria-pressed={displayUnit === u}
                  className={`tf-press px-2.5 py-1 text-[11px] font-semibold uppercase ${displayUnit === u ? 'bg-ink text-bg' : 'text-muted'}`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            {body.measurements
              .filter((m) => m.latest != null)
              .map((m) => (
                <div key={m.field} className="flex items-baseline justify-between border-b border-divider pb-2">
                  <span className="text-[13px] text-muted">{t(m.field)}</span>
                  <span className="text-right">
                    <span className="font-display text-[17px]">{fmt(m.field, m.latest as number)}</span>
                    {m.delta != null && m.delta !== 0 && (
                      <span className={`ml-1.5 text-[11px] ${m.delta < 0 ? 'text-accent' : 'text-faint'}`}>
                        {fmtDelta(m.field, m.delta)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      ) : (
        <p className="mb-4 text-[13px] text-faint">{t('measureEmpty')}</p>
      )}

      {open ? (
        <MeasureForm
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
          onCancel={() => setOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tf-press flex w-full items-center justify-center gap-2 border border-dashed border-line py-4 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
        >
          <Icon name="ruler" size={16} />
          {t('measureAdd')}
        </button>
      )}
    </>
  );
}

function MeasureForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }): ReactElement {
  const t = useTranslations('app.progress');
  const [unit, setUnit] = useState<LenUnit>('in');
  const [recordedOn, setRecordedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [vals, setVals] = useState<Record<MeasureField, string>>({
    waist: '',
    hips: '',
    chest: '',
    arms: '',
    thighs: '',
    bodyFat: '',
  });
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const [pending, start] = useTransition();

  function set(field: MeasureField, v: string): void {
    setVals((prev) => ({ ...prev, [field]: v }));
    if (status !== 'idle') setStatus('idle');
  }

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    const payload: Record<string, number | string> = { unit, recordedOn };
    for (const f of MEASURE_FIELDS) {
      const n = Number(vals[f]);
      if (vals[f].trim() !== '' && Number.isFinite(n) && n > 0) payload[f] = n;
    }
    if (!MEASURE_FIELDS.some((f) => f in payload)) {
      setStatus('error');
      return;
    }
    start(async () => {
      const res = await logMeasurementAction(payload);
      if (res.ok) onDone();
      else setStatus('error');
    });
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[2px] text-muted">{t('measureAdd')}</span>
        <div className="flex border border-line">
          {(['in', 'cm'] as LenUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              aria-pressed={unit === u}
              className={`tf-press px-2.5 py-1 text-[11px] font-semibold uppercase ${unit === u ? 'bg-ink text-bg' : 'text-muted'}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          {MEASURE_FIELDS.map((f) => (
            <label key={f} className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[1px] text-muted">
                {t(f)} {f === 'bodyFat' ? '%' : unit}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={vals[f]}
                onChange={(e) => set(f, e.target.value)}
                className="w-full border border-line bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-ink"
              />
            </label>
          ))}
        </div>

        <label className="mb-1 mt-3 block text-[11px] font-semibold uppercase tracking-[1px] text-muted">
          {t('dateLabel')}
        </label>
        <input
          type="date"
          value={recordedOn}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setRecordedOn(e.target.value)}
          className="mb-3 w-full border border-line bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-ink"
        />

        {status === 'error' && <p className="mb-2 text-[12px] text-red-600">{t('measureError')}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="tf-press flex-1 border border-line py-3 text-[12px] font-semibold uppercase tracking-[1px] text-muted disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="tf-press flex-1 border border-ink bg-ink py-3 text-[12px] font-semibold uppercase tracking-[1px] text-bg disabled:opacity-50"
          >
            {pending ? t('saving') : t('saveGeneric')}
          </button>
        </div>
      </form>
    </Card>
  );
}

// "Jun 16-22" or "Jun 30 - Jul 6" for a trailing week.
function weekLabel(startIso: string, endIso: string, locale: string): string {
  const parse = (iso: string): Date => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  const s = parse(startIso);
  const e = parse(endIso);
  const sMonth = new Intl.DateTimeFormat(locale, { month: 'short' }).format(s);
  const eMonth = new Intl.DateTimeFormat(locale, { month: 'short' }).format(e);
  if (sMonth === eMonth) return `${sMonth} ${s.getDate()}-${e.getDate()}`;
  return `${sMonth} ${s.getDate()} - ${eMonth} ${e.getDate()}`;
}
