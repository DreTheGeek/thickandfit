'use client';

import { useMemo, useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { saveSubstitutionChainAction } from '@/lib/coach/substitution-actions';
import type { ContextChain, ReasonTag } from '@/lib/coach/exercises';

const CONTEXTS = ['gym', 'bodyweight', 'bands', 'freeweights', 'machines'] as const;
type Context = (typeof CONTEXTS)[number];

type Candidate = { id: string; name: string; muscleGroup: string | null; equipment: string | null };

type ChainItem = { id: string; name: string; reasonTag: string | null };

type SaveState = 'idle' | 'saved' | 'error';

export function SubstitutionEditor({
  exerciseId,
  chains,
  reasonTags,
  candidates,
}: {
  exerciseId: string;
  chains: ContextChain[];
  reasonTags: ReasonTag[];
  candidates: Candidate[];
}): ReactElement {
  const t = useTranslations('app.coach');
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Context>('gym');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [query, setQuery] = useState('');

  // Per-context working chains, seeded from resolved server data.
  const [byContext, setByContext] = useState<Record<Context, ChainItem[]>>(() => {
    const initial = {} as Record<Context, ChainItem[]>;
    for (const c of CONTEXTS) {
      const chain = chains.find((ch) => ch.context === c);
      initial[c] = (chain?.substitutes ?? [])
        .filter((s) => s.exercise != null)
        .map((s) => ({ id: s.exercise!.id, name: s.exercise!.name, reasonTag: s.reasonTag }));
    }
    return initial;
  });

  const items = byContext[active];
  const chosenIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  const tabOptions: SegmentedOption<Context>[] = CONTEXTS.map((c) => ({ value: c, label: t(`subContext_${c}`) }));

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((c) => c.id !== exerciseId && !chosenIds.has(c.id))
      .filter((c) => (q ? `${c.name} ${c.muscleGroup ?? ''} ${c.equipment ?? ''}`.toLowerCase().includes(q) : true))
      .slice(0, 30);
  }, [candidates, query, chosenIds, exerciseId]);

  function update(next: ChainItem[]): void {
    setByContext((prev) => ({ ...prev, [active]: next }));
    setSaveState('idle');
  }

  function addItem(c: Candidate): void {
    update([...items, { id: c.id, name: c.name, reasonTag: null }]);
    setQuery('');
  }

  function removeItem(id: string): void {
    update(items.filter((i) => i.id !== id));
  }

  function move(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  }

  function setReason(id: string, reasonTag: string | null): void {
    update(items.map((i) => (i.id === id ? { ...i, reasonTag } : i)));
  }

  function save(): void {
    startTransition(async () => {
      const result = await saveSubstitutionChainAction({
        exerciseId,
        context: active,
        items: items.map((i) => ({ substitute_exercise_id: i.id, reason_tag: i.reasonTag ?? undefined })),
      });
      setSaveState(result.ok ? 'saved' : 'error');
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="tf-scroll -mx-1 overflow-x-auto px-1 pb-1">
        <Segmented options={tabOptions} value={active} onChange={(v) => { setActive(v); setSaveState('idle'); }} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ordered chain */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="tf-display text-[18px]">{t('subOrderedTitle')}</span>
            <span className="text-[12px] text-muted">{t('subContextLabel', { context: t(`subContext_${active}`) })}</span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl bg-surface p-6 text-center text-[13px] text-faint shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              {t('subEmpty')}
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className="rounded-2xl bg-surface p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-bg">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{item.name}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={t('subMoveUp')}
                        className="tf-press rounded-full border border-line p-1.5 text-soft disabled:opacity-30 hover:border-ink hover:text-ink"
                      >
                        <Icon name="chevronLeft" size={13} className="rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === items.length - 1}
                        aria-label={t('subMoveDown')}
                        className="tf-press rounded-full border border-line p-1.5 text-soft disabled:opacity-30 hover:border-ink hover:text-ink"
                      >
                        <Icon name="chevronRight" size={13} className="rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={t('subRemove')}
                        className="tf-press rounded-full border border-line p-1.5 text-soft hover:border-alert hover:text-alert"
                      >
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2.5 pl-10">
                    <select
                      value={item.reasonTag ?? ''}
                      onChange={(e) => setReason(item.id, e.target.value || null)}
                      className="tf-press w-full rounded-full border border-line bg-warm px-3.5 py-1.5 text-[12px] font-semibold text-muted outline-none focus:border-ink"
                    >
                      <option value="">{t('subReasonNone')}</option>
                      {reasonTags.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="tf-press inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-bg disabled:opacity-50"
            >
              {pending ? t('subSaving') : t('subSave')}
            </button>
            {saveState === 'saved' && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent">
                <Icon name="check" size={14} /> {t('subSaved')}
              </span>
            )}
            {saveState === 'error' && <span className="text-[12px] font-semibold text-alert">{t('subError')}</span>}
          </div>
        </div>

        {/* candidate picker */}
        <div className="flex flex-col gap-3">
          <span className="tf-display text-[18px]">{t('subAddTitle')}</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
              <Icon name="search" size={16} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('exercisesSearch')}
              className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[14px] outline-none placeholder:text-faint focus:border-ink"
            />
          </div>
          {filteredCandidates.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-faint">{t('exercisesNoneFiltered')}</p>
          ) : (
            <ul className="tf-scroll flex max-h-[460px] flex-col gap-2 overflow-y-auto pr-1">
              {filteredCandidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => addItem(c)}
                    className="tf-press group flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warm text-soft group-hover:bg-ink group-hover:text-bg">
                      <Icon name="plus" size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{c.name}</span>
                      <span className="block truncate text-[11px] capitalize text-muted">
                        {[c.muscleGroup, c.equipment].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
