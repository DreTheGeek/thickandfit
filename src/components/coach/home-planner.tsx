'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Icon } from '@/components/ui/icons';
import { CompletionCheck } from '@/components/ui/completion';

export type PlannerDay = { key: string; label: string; day: number; isToday: boolean };
type Task = { id: number; text: string; done: boolean };

/** Right-rail planner: week strip + a simple task list (session-local for now). */
export function HomePlanner({
  rangeLabel,
  weekDays,
}: {
  rangeLabel: string;
  weekDays: PlannerDay[];
}): ReactElement {
  const t = useTranslations('app.coach');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function add(): void {
    const text = draft.trim();
    if (!text) {
      setAdding(false);
      return;
    }
    setTasks((prev) => [...prev, { id: prev.length + 1, text, done: false }]);
    setDraft('');
    setAdding(false);
  }

  return (
    <aside className="w-full shrink-0 border-line bg-surface p-6 xl:w-[340px] xl:border-l">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="tf-display text-[22px]">{t('planner')}</h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="tf-press rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[1px] text-muted hover:border-ink hover:text-ink"
        >
          {t('addTask')}
        </button>
      </div>

      <div className="mb-3 text-[13px] font-medium text-muted">{rangeLabel}</div>
      <div className="mb-6 flex justify-between">
        {weekDays.map((d) => (
          <div key={d.key} className="text-center">
            <div className="text-[11px] text-faint">{d.label}</div>
            {d.isToday ? (
              <div className="mx-auto mt-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink text-[13px] text-white">
                {d.day}
              </div>
            ) : (
              <div className="mt-2 text-[13px] text-faint">{d.day}</div>
            )}
          </div>
        ))}
      </div>

      <div className="mb-2 text-[13px] font-semibold">{t('today')}</div>

      {adding && (
        <div className="mb-3 flex items-center gap-2 border border-line px-3 py-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            onBlur={add}
            placeholder={t('addTask')}
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
        </div>
      )}

      {tasks.length === 0 && !adding ? (
        <p className="py-6 text-center text-[13px] text-faint">{t('noTasks')}</p>
      ) : (
        <div className="flex flex-col">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() =>
                setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x)))
              }
              className="flex items-center gap-3 border-b border-divider py-2.5 text-left last:border-0"
            >
              <CompletionCheck done={task.done} size={20} />
              <span className={['text-[14px]', task.done ? 'text-faint line-through' : ''].join(' ')}>
                {task.text}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-faint">
        <Icon name="calendar" size={13} /> {t('comingSoonShort')}
      </div>
    </aside>
  );
}
