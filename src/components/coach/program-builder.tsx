'use client';
// Coach program builder on the proven /api/programs engine: program meta + day cards with
// an exercise picker, save, save-as-template, and assign-to-subscriber. Responsive.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

type Ex = { exercise_id: string; name: string; sets: number; reps: number; rest: number };
type Day = { label: string; exercises: Ex[] };
export type BuilderInitial = { id?: string; nameEn: string; nameEs: string; weeks: number; days: Day[] };
type SubOption = { id: string; name: string };

const input = 'border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-ink';
const numInput = 'w-14 border border-line bg-surface px-2 py-1 text-center text-[13px] outline-none focus:border-ink';

export function ProgramBuilder({
  initial,
  subscribers,
}: {
  initial: BuilderInitial;
  subscribers: SubOption[];
}): ReactElement {
  const t = useTranslations('app.coach');
  const [nameEn, setNameEn] = useState(initial.nameEn);
  const [nameEs, setNameEs] = useState(initial.nameEs);
  const [weeks, setWeeks] = useState(initial.weeks || 4);
  const [days, setDays] = useState<Day[]>(initial.days);
  const [planId, setPlanId] = useState<string | undefined>(initial.id);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const [picker, setPicker] = useState<{ dayIndex: number } | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (picker == null) return undefined;
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    fetch(`/api/exercises?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => setResults((j?.data?.exercises ?? []).slice(0, 25).map((e: { id: string; name_en: string }) => ({ id: e.id, name: e.name_en }))))
      .catch(() => {});
    return () => ctrl.abort();
  }, [q, picker]);

  const addDay = (): void => setDays((d) => [...d, { label: `Day ${d.length + 1}`, exercises: [] }]);
  const removeDay = (i: number): void => setDays((d) => d.filter((_, idx) => idx !== i));
  const setLabel = (i: number, v: string): void => setDays((d) => d.map((x, idx) => (idx === i ? { ...x, label: v } : x)));
  const removeEx = (di: number, ei: number): void =>
    setDays((d) => d.map((x, idx) => (idx === di ? { ...x, exercises: x.exercises.filter((_, j) => j !== ei) } : x)));
  const setEx = (di: number, ei: number, patch: Partial<Ex>): void =>
    setDays((d) => d.map((x, idx) => (idx === di ? { ...x, exercises: x.exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)) } : x)));
  const addEx = (e: { id: string; name: string }): void => {
    if (picker == null) return;
    const di = picker.dayIndex;
    setDays((d) => d.map((x, idx) => (idx === di ? { ...x, exercises: [...x.exercises, { exercise_id: e.id, name: e.name, sets: 3, reps: 10, rest: 60 }] } : x)));
  };

  async function save(): Promise<string | undefined> {
    setBusy(true);
    setStatus('');
    const payload = {
      id: planId,
      name_en: nameEn || 'Untitled program',
      name_es: nameEs || undefined,
      weeks,
      sessions: days.map((d) => ({
        day_label: d.label || 'Day',
        exercises: d.exercises.map((e) => ({ exercise_id: e.exercise_id, format: 'straight' as const, sets: e.sets, reps: e.reps, rest_sec: e.rest })),
      })),
    };
    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.data?.planId) {
      setPlanId(json.data.planId);
      setStatus(t('saved'));
      return json.data.planId;
    }
    setStatus(t('saveFailed'));
    return undefined;
  }

  async function makeTemplate(): Promise<void> {
    const id = planId ?? (await save());
    if (!id) return;
    await fetch(`/api/programs/${id}/template`, { method: 'POST' }).catch(() => {});
    setStatus(t('template'));
  }

  async function assign(): Promise<void> {
    if (!assignTo) return;
    const id = planId ?? (await save());
    if (!id) return;
    const res = await fetch(`/api/programs/${id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: assignTo }),
    });
    setStatus(res.ok ? t('assigned') : t('saveFailed'));
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <Link href="/coach/programs" className="tf-press mb-3 inline-flex items-center gap-2 text-[13px] text-muted">
        <Icon name="arrowLeft" size={16} /> {t('backToPrograms')}
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="tf-display text-[30px]">{t('programBuilder')}</h1>
        <div className="flex items-center gap-2.5">
          {status && <span className="text-[13px] text-muted">{status}</span>}
          <Button variant="outline" size="sm" onClick={makeTemplate}>
            {t('makeTemplate')}
          </Button>
          <Button size="sm" disabled={busy} onClick={save}>
            {busy ? '…' : t('saveProgram')}
          </Button>
        </div>
      </div>

      {/* Meta */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_120px]">
        <input className={input} placeholder={t('programNameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        <input className={input} placeholder={t('programNameEs')} value={nameEs} onChange={(e) => setNameEs(e.target.value)} />
        <label className="flex items-center gap-2">
          <span className="text-[12px] text-muted">{t('weeks')}</span>
          <input type="number" min={1} max={52} className={`${input} w-full`} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />
        </label>
      </div>

      {/* Day cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {days.map((d, di) => (
          <div key={di} className="rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center gap-2">
              <input className={`${input} flex-1 py-1.5`} value={d.label} onChange={(e) => setLabel(di, e.target.value)} />
              <button type="button" onClick={() => removeDay(di)} aria-label={t('removeDay')} className="tf-press text-faint hover:text-ink">
                <Icon name="x" size={16} />
              </button>
            </div>
            {d.exercises.map((e, ei) => (
              <div key={ei} className="flex items-center gap-2 border-b border-divider py-2 last:border-0">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{e.name}</span>
                <input type="number" className={numInput} value={e.sets} onChange={(ev) => setEx(di, ei, { sets: Number(ev.target.value) })} aria-label={t('sets')} />
                <span className="text-faint">×</span>
                <input type="number" className={numInput} value={e.reps} onChange={(ev) => setEx(di, ei, { reps: Number(ev.target.value) })} aria-label={t('reps')} />
                <button type="button" onClick={() => removeEx(di, ei)} className="tf-press text-faint hover:text-ink">
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => { setPicker({ dayIndex: di }); setQ(''); }}
              className="tf-press mt-3 w-full bg-warm py-2 text-[12px] font-semibold text-muted hover:text-ink"
            >
              + {t('addExercise')}
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addDay}
        className="tf-press mt-4 w-full border border-dashed border-line py-3.5 text-[13px] text-muted hover:border-ink hover:text-ink"
      >
        + {t('addDay')}
      </button>

      {/* Assign */}
      {subscribers.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-line pt-6">
          <span className="text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('assignTo')}</span>
          <select className={input} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">{t('assignToPlaceholder')}</option>
            {subscribers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" disabled={!assignTo} onClick={assign}>
            {t('assign')}
          </Button>
        </div>
      )}

      {/* Exercise picker modal */}
      {picker != null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button type="button" aria-label="close" onClick={() => setPicker(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-surface p-5 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="tf-display text-[20px]">{t('exerciseLibrary')}</span>
              <button type="button" onClick={() => setPicker(null)} className="tf-press text-faint"><Icon name="x" size={18} /></button>
            </div>
            <div className="mb-3 flex items-center gap-2 border border-line px-3 py-2.5">
              <Icon name="search" size={16} className="text-faint" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchExercises')} className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint" />
            </div>
            <div className="tf-scroll min-h-0 flex-1 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addEx(r)}
                  className="tf-press flex w-full items-center justify-between border-b border-divider py-2.5 text-left text-[14px] last:border-0"
                >
                  <span className="truncate">{r.name}</span>
                  <Icon name="plus" size={16} className="text-muted" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
