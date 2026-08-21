'use client';
/**
 * The program builder, rebuilt around what Stephanie actually has.
 *
 * She did not arrive needing a tool to invent programs. She arrived with 41 of them, 229 sessions
 * and 2,501 prescribed movements already written, plus 366 filmed demos to go with them. The old
 * builder listed those movements as bare NAMES with a sets box and a reps box, which is a
 * spreadsheet with extra steps, and the one thing that makes this app not a spreadsheet, her
 * footage, was nowhere on the screen.
 *
 * Worse, it was a data-loss tool. saveProgram deletes a plan's sessions and re-inserts them, and
 * this component sent sets, reps and rest_sec only. One tap of SAVE PROGRAM on any imported plan
 * would have erased 1,531 superset groupings, 2,066 rep ranges, 2,438 coaching notes and 271 timed
 * durations, silently, behind a success toast. Every field now round-trips, and
 * .qa-visual/program-roundtrip-test.mjs fails if a new column is ever added without one.
 *
 * ONE DAY AT A TIME. The old three-column grid put 22 movements of leg day beside 24 of upper body
 * beside a cardio day, which is a wall. Days are tabs; you edit the one you are looking at.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { exerciseKind, isWeighted, formatDuration } from '@/lib/workout/exercise-kind';

export type BuilderEx = {
  exercise_id: string;
  name: string;
  equipment: string | null;
  muscle: string | null;
  /** Her filmed demo, already signed by the server. Null for the ~940 seeded catalog movements. */
  demoUrl: string | null;
  format: 'straight' | 'circuit' | 'superset';
  sets: number | null;
  reps: number | null;
  repsMin: number | null;
  repsMax: number | null;
  isAmrap: boolean;
  timeSec: number | null;
  weight: number | null;
  rest: number | null;
  rounds: number | null;
  notes: string | null;
  groupKey: string | null;
  groupKind: string | null;
};
type Day = { label: string; exercises: BuilderEx[] };
export type BuilderInitial = { id?: string; nameEn: string; nameEs: string; weeks: number; days: Day[] };
type SubOption = { id: string; name: string };

const input = 'border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-ink';
const numInput =
  'w-14 rounded-lg border border-line bg-surface px-2 py-1 text-center text-[13px] tabular-nums outline-none focus:border-ink';
const rangeInput =
  'w-11 rounded-lg border border-line bg-surface px-1 py-1 text-center text-[13px] tabular-nums outline-none focus:border-ink';

/** A movement dropped in fresh. Sensible starting numbers; everything else stays null until said. */
function blankEx(id: string, name: string): BuilderEx {
  return {
    exercise_id: id,
    name,
    equipment: null,
    muscle: null,
    demoUrl: null,
    format: 'straight',
    sets: 3,
    reps: 10,
    repsMin: null,
    repsMax: null,
    isAmrap: false,
    timeSec: null,
    weight: null,
    rest: 60,
    rounds: null,
    notes: null,
    groupKey: null,
    groupKind: null,
  };
}

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
  const [dayIdx, setDayIdx] = useState(0);
  const [openEx, setOpenEx] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  /**
   * Anything changed since the last save.
   *
   * This exists because the save is destructive by design: it deletes and rebuilds the plan's
   * sessions. A coach who opens a plan, reads it and navigates away should never have to wonder
   * whether she saved, and an UNCHANGED plan should never be rewritten at all.
   */
  const [dirty, setDirty] = useState(false);

  const [picker, setPicker] = useState<{ dayIndex: number } | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const dragFrom = useRef<number | null>(null);

  useEffect(() => {
    if (picker == null) return undefined;
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    fetch(`/api/exercises?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) =>
        setResults(
          (j?.data?.exercises ?? [])
            .slice(0, 25)
            .map((e: { id: string; name_en: string }) => ({ id: e.id, name: e.name_en })),
        ),
      )
      .catch((e: unknown) => {
        // Aborts are expected on cleanup/re-key; real failures should not die silently.
        if (!(e instanceof DOMException && e.name === 'AbortError')) console.error('exercise search:', e);
      });
    return () => ctrl.abort();
  }, [q, picker]);

  // A destructive save sitting behind an accidental tab close.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const day = days[dayIdx] ?? null;

  // Every mutation goes through here, so nothing can change the plan without arming the save.
  const edit = (fn: (d: Day[]) => Day[]): void => {
    setDays((d) => fn(d));
    setDirty(true);
    setStatus('');
  };

  const addDay = (): void => {
    setDayIdx(days.length);
    edit((d) => [...d, { label: `Day ${d.length + 1}`, exercises: [] }]);
  };
  const removeDay = (i: number): void => {
    setDayIdx((cur) => Math.max(0, cur >= i ? cur - 1 : cur));
    edit((d) => d.filter((_, idx) => idx !== i));
  };
  const setLabel = (i: number, v: string): void =>
    edit((d) => d.map((x, idx) => (idx === i ? { ...x, label: v } : x)));
  const removeEx = (ei: number): void =>
    edit((d) =>
      d.map((x, idx) => (idx === dayIdx ? { ...x, exercises: x.exercises.filter((_, j) => j !== ei) } : x)),
    );
  const setEx = (ei: number, patch: Partial<BuilderEx>): void =>
    edit((d) =>
      d.map((x, idx) =>
        idx === dayIdx ? { ...x, exercises: x.exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)) } : x,
      ),
    );

  /** Move a movement within the day. Used by both the drag and the arrow buttons. */
  const moveEx = (from: number, to: number): void => {
    if (from === to || to < 0) return;
    edit((d) =>
      d.map((x, idx) => {
        if (idx !== dayIdx) return x;
        if (to >= x.exercises.length) return x;
        const list = [...x.exercises];
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
        return { ...x, exercises: list };
      }),
    );
    setOpenEx((cur) => (cur === from ? to : cur));
  };

  const addEx = (e: { id: string; name: string }): void => {
    if (picker == null) return;
    const di = picker.dayIndex;
    edit((d) =>
      d.map((x, idx) => (idx === di ? { ...x, exercises: [...x.exercises, blankEx(e.id, e.name)] } : x)),
    );
  };

  /**
   * Supersets, resolved once per day.
   *
   * group_key ties movements performed back to back. The badge shows "SUPERSET 1 of 2" so she can
   * read the shape of the day without opening every row. 61% of her prescribed movements sit in one
   * of these and the old builder rendered none of them.
   */
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of day?.exercises ?? []) {
      if (e.groupKey) counts.set(e.groupKey, (counts.get(e.groupKey) ?? 0) + 1);
    }
    return counts;
  }, [day]);

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
        // EVERY FIELD. See the header: an omission here is not a missing feature, it is deletion.
        exercises: d.exercises.map((e) => ({
          exercise_id: e.exercise_id,
          format: e.format,
          sets: e.sets,
          reps: e.reps,
          reps_min: e.repsMin,
          reps_max: e.repsMax,
          is_amrap: e.isAmrap,
          time_sec: e.timeSec,
          weight: e.weight,
          rest_sec: e.rest,
          rounds: e.rounds,
          notes: e.notes,
          group_key: e.groupKey,
          group_kind: e.groupKind,
        })),
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
      setDirty(false);
      setStatus(t('savedLive'));
      return json.data.planId;
    }
    setStatus(t('saveFailed'));
    return undefined;
  }

  async function makeTemplate(): Promise<void> {
    const id = planId ?? (await save());
    if (!id) return;
    await fetch(`/api/programs/${id}/template`, { method: 'POST' }).catch((e: unknown) => {
      // The template save is best-effort; log it so a silent failure is visible.
      console.error('makeTemplate:', e instanceof Error ? e.message : e);
    });
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
    <div>
      <Link href="/coach/programs" className="tf-press mb-3 inline-flex items-center gap-2 text-[13px] text-muted">
        <Icon name="arrowLeft" size={16} /> {t('backToPrograms')}
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="tf-display text-[30px]">{t('programBuilder')}</h1>
        <div className="flex items-center gap-2.5">
          {status && <span className="text-[13px] text-muted">{status}</span>}
          {dirty && !status && <span className="text-[13px] text-muted">{t('unsaved')}</span>}
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
        <input
          className={input}
          placeholder={t('programNameEn')}
          value={nameEn}
          onChange={(e) => {
            setNameEn(e.target.value);
            setDirty(true);
          }}
        />
        <input
          className={input}
          placeholder={t('programNameEs')}
          value={nameEs}
          onChange={(e) => {
            setNameEs(e.target.value);
            setDirty(true);
          }}
        />
        <label className="flex items-center gap-2">
          <span className="text-[12px] text-muted">{t('weeks')}</span>
          <input
            type="number"
            min={1}
            max={52}
            className={`${input} w-full`}
            value={weeks}
            onChange={(e) => {
              setWeeks(Number(e.target.value));
              setDirty(true);
            }}
          />
        </label>
      </div>

      {/* DAY TABS. One day on screen at a time; the count under each name is how much work it is. */}
      <div className="tf-scroll -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setDayIdx(i);
              setOpenEx(null);
            }}
            className={[
              'tf-press flex-none rounded-xl px-3.5 py-2 text-left',
              i === dayIdx ? 'bg-ink text-bg' : 'bg-surface text-muted',
            ].join(' ')}
          >
            <span className="block max-w-[150px] truncate text-[13px] font-semibold">
              {d.label || t('untitledDay')}
            </span>
            <span className={`block text-[11px] ${i === dayIdx ? 'text-bg/60' : 'text-faint'}`}>
              {t('movementCount', { count: d.exercises.length })}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={addDay}
          className="tf-press flex-none rounded-xl border border-dashed border-line px-3.5 py-2 text-[13px] text-muted hover:border-ink hover:text-ink"
        >
          + {t('addDay')}
        </button>
      </div>

      {day && (
        <div className="rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="mb-3 flex items-center gap-2">
            <input
              className={`${input} flex-1 py-1.5 font-semibold`}
              value={day.label}
              onChange={(e) => setLabel(dayIdx, e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeDay(dayIdx)}
              aria-label={t('removeDay')}
              className="tf-press text-faint hover:text-ink"
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          {day.exercises.length === 0 && (
            <p className="py-8 text-center text-[13px] text-muted">{t('emptyDay')}</p>
          )}

          {day.exercises.map((e, ei) => {
            const kind = exerciseKind({
              reps: e.reps,
              repsMin: e.repsMin,
              repsMax: e.repsMax,
              isAmrap: e.isAmrap,
              timeSec: e.timeSec,
            });
            const weighted = kind === 'reps' && isWeighted(e.equipment);
            const inGroup = e.groupKey ? (groups.get(e.groupKey) ?? 0) : 0;
            const groupPos = e.groupKey
              ? day.exercises.filter((x) => x.groupKey === e.groupKey).indexOf(e) + 1
              : 0;
            const open = openEx === ei;
            const demo = e.demoUrl;
            return (
              <div
                key={`${e.exercise_id}-${ei}`}
                draggable
                onDragStart={() => {
                  dragFrom.current = ei;
                }}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={() => {
                  if (dragFrom.current != null) moveEx(dragFrom.current, ei);
                  dragFrom.current = null;
                }}
                className="border-b border-divider py-2.5 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  {/* DRAG for a mouse, ARROWS for everything else. HTML5 drag-and-drop does not fire
                      on touch at all, so a drag handle alone would be a reorder feature that
                      silently does nothing on the device she is most likely holding. */}
                  <span className="cursor-grab text-faint active:cursor-grabbing" aria-hidden>
                    <Icon name="grid" size={14} />
                  </span>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveEx(ei, ei - 1)}
                      disabled={ei === 0}
                      aria-label={t('moveUp')}
                      className="tf-press text-faint hover:text-ink disabled:opacity-25"
                    >
                      <Icon name="chevronRight" size={13} className="-rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveEx(ei, ei + 1)}
                      disabled={ei === day.exercises.length - 1}
                      aria-label={t('moveDown')}
                      className="tf-press text-faint hover:text-ink disabled:opacity-25"
                    >
                      <Icon name="chevronRight" size={13} className="rotate-90" />
                    </button>
                  </div>

                  {/* HER FOOTAGE, on the row. "What these should be is the videos that go to these
                      workouts." The still is seeded at 0.1s rather than 0: most encoders put a black
                      frame at zero, so a poster taken from the start is a black square. */}
                  {demo ? (
                    <button
                      type="button"
                      onClick={() => setPreview({ name: e.name, url: demo })}
                      aria-label={t('playDemo', { name: e.name })}
                      className="tf-press relative h-[46px] w-[46px] flex-none overflow-hidden rounded-lg bg-black"
                    >
                      <video
                        src={`${demo}#t=0.1`}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                        <Icon name="play" size={16} />
                      </span>
                    </button>
                  ) : (
                    <span
                      title={t('noDemo')}
                      className="grid h-[46px] w-[46px] flex-none place-items-center rounded-lg bg-warm text-faint"
                    >
                      <Icon name="dumbbell" size={18} />
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenEx(open ? null : ei)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{e.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
                      {inGroup > 1 && (
                        <span className="rounded bg-accent/12 px-1.5 py-px font-semibold text-accent">
                          {t('supersetBadge', { pos: groupPos, total: inGroup })}
                        </span>
                      )}
                      {e.muscle && <span className="capitalize">{e.muscle}</span>}
                      {e.equipment && <span className="capitalize">· {e.equipment}</span>}
                      {e.notes && <span>· {t('hasNote')}</span>}
                    </span>
                  </button>

                  {/* THE PRESCRIPTION, in the shape she wrote it. A timed movement gets a duration
                      box, not a sets box and a reps box: the old builder showed 3 x 10 beside a
                      25-minute incline walk, and saving it made that true. */}
                  {kind === 'timed' ? (
                    <label className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        className={numInput}
                        value={Math.round((e.timeSec ?? 0) / 60)}
                        onChange={(ev) => setEx(ei, { timeSec: Math.max(0, Number(ev.target.value)) * 60 })}
                        aria-label={t('minutes')}
                      />
                      <span className="text-[11px] text-faint">{t('minShort')}</span>
                    </label>
                  ) : kind === 'untracked' ? (
                    <span className="text-[11px] text-faint">{t('noPrescription')}</span>
                  ) : (
                    <>
                      <input
                        type="number"
                        min={0}
                        className={numInput}
                        value={e.sets ?? ''}
                        onChange={(ev) => setEx(ei, { sets: ev.target.value === '' ? null : Number(ev.target.value) })}
                        aria-label={t('sets')}
                      />
                      <span className="text-faint">×</span>
                      {e.isAmrap ? (
                        <span className="w-14 text-center text-[12px] font-semibold text-accent">
                          {t('amrapShort')}
                        </span>
                      ) : e.repsMin != null && e.repsMax != null && e.repsMax !== e.repsMin ? (
                        // A RANGE, kept as a range. Collapsing "8-12" into a single box is how 2,066
                        // of her rep ranges would have become single numbers on the first save.
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            className={rangeInput}
                            value={e.repsMin}
                            onChange={(ev) => setEx(ei, { repsMin: Number(ev.target.value) })}
                            aria-label={t('repsMin')}
                          />
                          <span className="text-faint">-</span>
                          <input
                            type="number"
                            min={0}
                            className={rangeInput}
                            value={e.repsMax}
                            onChange={(ev) => setEx(ei, { repsMax: Number(ev.target.value) })}
                            aria-label={t('repsMax')}
                          />
                        </span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          className={numInput}
                          value={e.reps ?? ''}
                          onChange={(ev) => setEx(ei, { reps: ev.target.value === '' ? null : Number(ev.target.value) })}
                          aria-label={t('reps')}
                        />
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => removeEx(ei)}
                    aria-label={t('removeExercise')}
                    className="tf-press text-faint hover:text-ink"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>

                {/* THE REST OF THE PRESCRIPTION, one tap down. Rest, load, and her note, the note
                    being the field 2,438 of her movements carry and that no screen in this app has
                    ever shown, in either console. */}
                {open && (
                  <div className="mt-2.5 rounded-xl bg-warm/50 p-3">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-faint">
                        {t('restSeconds')}
                        <input
                          type="number"
                          min={0}
                          className={numInput}
                          value={e.rest ?? ''}
                          onChange={(ev) => setEx(ei, { rest: ev.target.value === '' ? null : Number(ev.target.value) })}
                        />
                      </label>
                      {weighted && (
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-faint">
                          {t('targetWeight')}
                          <input
                            type="number"
                            min={0}
                            className={numInput}
                            value={e.weight ?? ''}
                            onChange={(ev) =>
                              setEx(ei, { weight: ev.target.value === '' ? null : Number(ev.target.value) })
                            }
                          />
                        </label>
                      )}
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-faint">
                        <input
                          type="checkbox"
                          checked={e.isAmrap}
                          onChange={(ev) => setEx(ei, { isAmrap: ev.target.checked })}
                        />
                        {t('amrapLabel')}
                      </label>
                      {/* Supersets are made and broken here. Sharing a key with the row above is the
                          whole mechanic, so it is one button rather than a text field nobody would
                          guess the format of. */}
                      <button
                        type="button"
                        onClick={() => {
                          const prev = day.exercises[ei - 1];
                          if (e.groupKey) {
                            setEx(ei, { groupKey: null, groupKind: null, format: 'straight' });
                          } else if (prev) {
                            const key = prev.groupKey ?? `g-${prev.exercise_id.slice(0, 8)}-${ei}`;
                            if (!prev.groupKey) {
                              setEx(ei - 1, { groupKey: key, groupKind: 'superset', format: 'superset' });
                            }
                            setEx(ei, { groupKey: key, groupKind: 'superset', format: 'superset' });
                          }
                        }}
                        disabled={ei === 0 && !e.groupKey}
                        className="tf-press rounded-full border border-line px-3 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-muted hover:text-ink disabled:opacity-30"
                      >
                        {e.groupKey ? t('breakSuperset') : t('supersetWithAbove')}
                      </button>
                      {e.timeSec != null && (
                        <span className="text-[11px] text-faint">
                          {t('durationIs', { duration: formatDuration(e.timeSec) })}
                        </span>
                      )}
                    </div>
                    <label className="mt-3 block">
                      <span className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">
                        {t('exerciseNote')}
                      </span>
                      <textarea
                        rows={3}
                        value={e.notes ?? ''}
                        onChange={(ev) => setEx(ei, { notes: ev.target.value || null })}
                        placeholder={t('exerciseNotePlaceholder')}
                        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-ink"
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setPicker({ dayIndex: dayIdx });
              setQ('');
            }}
            className="tf-press mt-3 w-full rounded-xl bg-warm py-2.5 text-[12px] font-semibold text-muted hover:text-ink"
          >
            + {t('addExercise')}
          </button>
        </div>
      )}

      {/* Assign */}
      {subscribers.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-line pt-6">
          <span className="text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('assignTo')}</span>
          <select className={input} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">{t('assignToPlaceholder')}</option>
            {subscribers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" disabled={!assignTo} onClick={assign}>
            {t('assign')}
          </Button>
        </div>
      )}

      {/* Demo preview. Her own footage, at a size she can actually check the form on. */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t('close')}
            onClick={() => setPreview(null)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-black">
            <video
              src={preview.url}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="max-h-[70vh] w-full bg-black object-contain"
            />
            <div className="flex items-center justify-between px-4 py-3 text-white">
              <span className="truncate text-[14px] font-semibold">{preview.name}</span>
              <button type="button" onClick={() => setPreview(null)} className="tf-press text-white/60">
                <Icon name="x" size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise picker modal */}
      {picker != null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label={t('close')}
            onClick={() => setPicker(null)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-surface p-5 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="tf-display text-[20px]">{t('exerciseLibrary')}</span>
              <button type="button" onClick={() => setPicker(null)} className="tf-press text-faint">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2 border border-line px-3 py-2.5">
              <Icon name="search" size={16} className="text-faint" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('searchExercises')}
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
              />
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
