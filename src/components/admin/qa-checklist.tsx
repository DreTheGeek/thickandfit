'use client';
// Operator QA board: grouped checklist with pass/fail/blocked + notes per item. Internal ops tool
// (English-only by design; the audience is the QA team, not members).
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { setQaStatusAction } from '@/lib/admin/qa-actions';

export type QaItem = {
  id: string;
  category: string;
  title: string;
  detail: string | null;
  status: 'todo' | 'pass' | 'fail' | 'blocked';
  notes: string | null;
  checkedBy: string | null;
};

const STATUS_STYLE: Record<QaItem['status'], string> = {
  todo: 'border border-line text-muted',
  pass: 'bg-accent/15 text-accent-ink border border-accent/40',
  fail: 'bg-alert text-alert-ink border border-alert-ink/30',
  blocked: 'bg-warm text-muted border border-line',
};

function Row({ item }: { item: QaItem }): ReactElement {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? '');

  function set(status: QaItem['status']): void {
    start(async () => {
      await setQaStatusAction({ id: item.id, status, notes: notes.trim() || undefined });
      router.refresh();
    });
  }

  return (
    <div className="border-b border-divider py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={['tf-press shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[1px]', STATUS_STYLE[item.status]].join(' ')}
        >
          {item.status}
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} className="tf-press min-w-0 flex-1 text-left text-[14px]">
          {item.title}
        </button>
        {item.checkedBy && <span className="shrink-0 text-[11px] text-faint">{item.checkedBy}</span>}
      </div>
      {open && (
        <div className="mt-2 rounded-xl bg-surface p-3">
          {item.detail && <p className="mb-2 whitespace-pre-line text-[13px] leading-relaxed text-muted">{item.detail}</p>}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Tester notes / bug repro..."
            className="mb-2 w-full resize-none rounded-lg border border-line bg-bg p-2 text-[13px] outline-none placeholder:text-faint focus:border-ink"
          />
          <div className="flex gap-2">
            {(['pass', 'fail', 'blocked', 'todo'] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending}
                onClick={() => set(s)}
                className={['tf-press rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[1px] disabled:opacity-40', STATUS_STYLE[s]].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function QaChecklist({ items }: { items: QaItem[] }): ReactElement {
  const [filter, setFilter] = useState<'all' | QaItem['status']>('all');
  const categories = [...new Set(items.map((i) => i.category))];
  const shown = filter === 'all' ? items : items.filter((i) => i.status === filter);
  const counts = {
    pass: items.filter((i) => i.status === 'pass').length,
    fail: items.filter((i) => i.status === 'fail').length,
    blocked: items.filter((i) => i.status === 'blocked').length,
    todo: items.filter((i) => i.status === 'todo').length,
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['all', 'todo', 'pass', 'fail', 'blocked'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={[
              'tf-press rounded-full px-3.5 py-1.5 text-[12px] font-semibold',
              filter === f ? 'bg-ink text-bg' : 'border border-line text-muted',
            ].join(' ')}
          >
            {f === 'all' ? `All ${items.length}` : `${f} ${counts[f]}`}
          </button>
        ))}
      </div>
      {categories.map((cat) => {
        const catItems = shown.filter((i) => i.category === cat);
        if (!catItems.length) return null;
        const done = items.filter((i) => i.category === cat && i.status === 'pass').length;
        const total = items.filter((i) => i.category === cat).length;
        return (
          <div key={cat} className="mb-5 rounded-2xl border border-line bg-bg p-4">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-[18px]">{cat}</h2>
              <span className="text-[12px] tabular-nums text-faint">{done}/{total} pass</span>
            </div>
            {catItems.map((i) => (
              <Row key={i.id} item={i} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
