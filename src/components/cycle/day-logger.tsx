'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { saveCycleDayAction } from '@/lib/cycle/day-actions';
import { SYMPTOMS, MOODS, ENERGY_MIN, ENERGY_MAX, type Symptom, type Mood } from '@/lib/cycle/vocab';

/**
 * How she logs a day.
 *
 * COLLAPSED BY DEFAULT. Most members open this screen, see where they are in their cycle, and
 * leave; the one tap that matters is "log my period", which lives above this. Making symptoms an
 * always-open wall of twenty toggles would put the rare action in front of the common one.
 *
 * A day is edited as a whole, so the toggles start from whatever was already saved and the save is
 * an upsert. Deselecting everything and saving CLEARS the day rather than storing an empty row, so
 * "logged nothing" and "opened it and changed my mind" end up in the same state.
 */
export function CycleDayLogger({
  today,
  initialSymptoms,
  initialMoods,
  initialEnergy,
}: {
  today: string;
  initialSymptoms: Symptom[];
  initialMoods: Mood[];
  initialEnergy: number | null;
}): ReactElement {
  const t = useTranslations('app.cycle');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [symptoms, setSymptoms] = useState<Symptom[]>(initialSymptoms);
  const [moods, setMoods] = useState<Mood[]>(initialMoods);
  const [energy, setEnergy] = useState<number | null>(initialEnergy);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  // FUNCTIONAL UPDATER, not `set(list.includes(v) ? ... )`. Reading the array from the closure means
  // two taps inside one React batch both see the pre-batch value and the second overwrites the
  // first, so tapping Cramps then Bloating quickly saves only Bloating. Caught doing exactly that.
  const toggle = <T extends string>(set: (fn: (prev: T[]) => T[]) => void, v: T): void =>
    set((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  function save(): void {
    setFailed(false);
    setSaved(false);
    start(async () => {
      const res = await saveCycleDayAction({ loggedOn: today, symptoms, moods, energy });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setFailed(true);
    });
  }

  const count = symptoms.length + moods.length + (energy != null ? 1 : 0);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tf-press w-full rounded-2xl border border-line bg-surface px-4 py-3 text-left text-[14px] font-semibold text-ink"
      >
        {t('logDayTitle')}
        {count > 0 && <span className="ml-2 text-[12px] font-medium text-muted">{t('logDayCount', { count })}</span>}
      </button>
    );
  }

  const chip = (on: boolean): string =>
    [
      'tf-press rounded-full border px-3 py-1.5 text-[13px]',
      on ? 'border-ink bg-ink text-bg' : 'border-line text-soft',
    ].join(' ');

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">{t('logDayTitle')}</div>

      <div>
        <div className="mb-2 text-[13px] font-semibold text-ink">{t('symptomsLabel')}</div>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => (
            <button key={s} type="button" onClick={() => toggle(setSymptoms, s)} aria-pressed={symptoms.includes(s)} className={chip(symptoms.includes(s))}>
              {t(`symptom.${s}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-semibold text-ink">{t('moodsLabel')}</div>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button key={m} type="button" onClick={() => toggle(setMoods, m)} aria-pressed={moods.includes(m)} className={chip(moods.includes(m))}>
              {t(`mood.${m}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-semibold text-ink">{t('energyLabel')}</div>
        <div className="flex gap-2">
          {/* Tapping the selected value again clears it: energy is optional, and without this there
              is no way back to "did not say" once a number has been pressed. */}
          {Array.from({ length: ENERGY_MAX - ENERGY_MIN + 1 }, (_, i) => i + ENERGY_MIN).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEnergy((prev) => (prev === n ? null : n))}
              aria-pressed={energy === n}
              className={[
                'tf-press h-11 flex-1 rounded-xl border text-[15px] font-semibold tabular-nums',
                energy === n ? 'border-ink bg-ink text-bg' : 'border-line text-soft',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button size="block" disabled={pending} onClick={save}>
          {pending ? '…' : t('saveDay')}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="tf-press shrink-0 text-[13px] text-muted">
          {t('close')}
        </button>
      </div>
      {saved && <p className="text-[12px] text-accent">{t('daySaved')}</p>}
      {failed && <p className="text-[12px] text-alert-ink">{t('saveError')}</p>}
    </Card>
  );
}
