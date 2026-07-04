'use client';
// Operator QA board: phase-grouped, filterable checklist. Each row expands to the exact spec (what it
// should do, how to trigger it, the expected result), notes, and a tester assignment. Testers mark
// pass/fail/blocked and their name is stamped as checked_by. Internal ops tool (English-only).
import { useMemo, useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { setQaStatusAction, assignTesterAction } from '@/lib/admin/qa-actions';

export type QaItem = {
  id: string;
  category: string;
  title: string;
  detail: string | null;
  status: 'todo' | 'pass' | 'fail' | 'blocked';
  notes: string | null;
  checkedBy: string | null;
  phase: string | null;
  phaseOrder: number;
  area: string | null;
  shouldDo: string | null;
  howToTrigger: string | null;
  expectedResult: string | null;
  involvesGhl: boolean;
  priority: string | null;
  assignedTester: string | null;
};

const TESTERS = ['Rodney', 'LaSean', 'Shakira'];
const STATUSES: QaItem['status'][] = ['todo', 'pass', 'fail', 'blocked'];
const STATUS_STYLE: Record<QaItem['status'], string> = {
  todo: 'border border-line text-muted',
  pass: 'text-[#175C38] bg-[#DEEDE3] border border-[#1F7A46]/40',
  fail: 'text-[#8C3325] bg-[#F6E2DC] border border-[#B4462F]/40',
  blocked: 'text-[#7A570E] bg-[#F5EAD0] border border-[#B98A1C]/40',
};

function Field({ label, value }: { label: string; value: string | null }): ReactElement | null {
  if (!value) return null;
  return (
    <div className="mt-2">
      <div className="text-[10px] font-semibold uppercase tracking-[1px] text-faint">{label}</div>
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-soft">{value}</p>
    </div>
  );
}

function Row({ item }: { item: QaItem }): ReactElement {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? '');

  const set = (status: QaItem['status']): void => {
    start(async () => { await setQaStatusAction({ id: item.id, status, notes: notes.trim() || undefined }); router.refresh(); });
  };
  const assign = (tester: string): void => {
    start(async () => { await assignTesterAction({ id: item.id, tester: tester || null }); router.refresh(); });
  };

  return (
    <div className="border-b border-divider py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className={['shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[1px]', STATUS_STYLE[item.status]].join(' ')}>{item.status}</span>
        <button type="button" onClick={() => setOpen((v) => !v)} className="tf-press min-w-0 flex-1 text-left text-[14px] font-medium text-ink">
          {item.title}
          {item.involvesGhl && <span className="ml-2 rounded-full bg-[#E2EAF4] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[#274E75]">GHL</span>}
          {item.priority === 'critical' && <span className="ml-1.5 rounded-full bg-[#F6E2DC] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[#8C3325]">critical</span>}
        </button>
        {item.assignedTester && <span className="shrink-0 rounded-full bg-warm px-2 py-0.5 text-[10px] font-semibold text-soft">{item.assignedTester}</span>}
        {item.checkedBy && <span className="shrink-0 text-[11px] text-faint">✓ {item.checkedBy}</span>}
      </div>
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-surface p-3">
          <Field label="What it should do" value={item.shouldDo} />
          <Field label="How to trigger" value={item.howToTrigger} />
          <Field label="Expected result (pass criteria)" value={item.expectedResult} />
          {!item.shouldDo && item.detail && <Field label="Detail" value={item.detail} />}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-faint">Assign:</span>
            {TESTERS.map((t) => (
              <button key={t} type="button" onClick={() => assign(item.assignedTester === t ? '' : t)} disabled={pending}
                className={['tf-press rounded-full px-2.5 py-1 text-[11px] font-semibold', item.assignedTester === t ? 'bg-ink text-surface' : 'border border-line text-muted hover:border-ink'].join(' ')}>
                {t}
              </button>
            ))}
          </div>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Tester notes / bug repro..."
            className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] outline-none focus:border-ink" />
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => set(s)} disabled={pending}
                className={['tf-press rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[1px] disabled:opacity-40', item.status === s ? STATUS_STYLE[s] : 'border border-line text-muted hover:border-ink'].join(' ')}>
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
  const [phase, setPhase] = useState<string>('all');
  const [tester, setTester] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [ghlOnly, setGhlOnly] = useState(false);

  const phases = useMemo(() => {
    const seen = new Map<number, string>();
    for (const i of items) if (i.phase) seen.set(i.phaseOrder, i.phase);
    return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([, name]) => name);
  }, [items]);

  const filtered = useMemo(() => items.filter((i) =>
    (phase === 'all' || i.phase === phase) &&
    (tester === 'all' || i.assignedTester === tester) &&
    (status === 'all' || i.status === status) &&
    (!ghlOnly || i.involvesGhl),
  ), [items, phase, tester, status, ghlOnly]);

  const passed = items.filter((i) => i.status === 'pass').length;
  const failed = items.filter((i) => i.status === 'fail').length;

  const grouped = useMemo(() => {
    const byPhase = new Map<string, QaItem[]>();
    for (const i of filtered) {
      const key = i.phase ?? 'Unphased';
      const arr = byPhase.get(key);
      if (arr) arr.push(i);
      else byPhase.set(key, [i]);
    }
    return [...byPhase.entries()].sort((a, b) => (a[1][0]?.phaseOrder ?? 99) - (b[1][0]?.phaseOrder ?? 99));
  }, [filtered]);

  const chip = (active: boolean): string =>
    ['tf-press rounded-full px-3 py-1.5 text-[12px] font-semibold', active ? 'bg-ink text-surface' : 'border border-line text-muted hover:border-ink'].join(' ');

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-[12px] text-muted">
        <span><strong className="text-ink">{passed}</strong> passed</span>
        <span><strong className="text-[#B4462F]">{failed}</strong> failed</span>
        <span><strong className="text-ink">{items.length}</strong> total</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-[#1F7A46]" style={{ width: `${items.length ? (passed / items.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setPhase('all')} className={chip(phase === 'all')}>All phases</button>
          {phases.map((p) => <button key={p} type="button" onClick={() => setPhase(p)} className={chip(phase === p)}>{p}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setTester('all')} className={chip(tester === 'all')}>All testers</button>
          {TESTERS.map((t) => <button key={t} type="button" onClick={() => setTester(t)} className={chip(tester === t)}>{t}</button>)}
          <span className="mx-1 h-5 w-px bg-line" />
          {STATUSES.map((s) => <button key={s} type="button" onClick={() => setStatus(status === s ? 'all' : s)} className={chip(status === s)}>{s}</button>)}
          <button type="button" onClick={() => setGhlOnly((v) => !v)} className={chip(ghlOnly)}>GHL only</button>
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-[13px] text-faint">No items match these filters.</p>
      ) : (
        grouped.map(([phaseName, phaseItems]) => (
          <section key={phaseName} className="mb-5">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="font-display text-[15px] uppercase tracking-tight">{phaseName}</h3>
              <span className="text-[11px] text-faint">{phaseItems.length} items · {phaseItems.filter((i) => i.status === 'pass').length} passed</span>
            </div>
            <div className="rounded-2xl border border-line bg-bg px-4">
              {phaseItems.map((i) => <Row key={i.id} item={i} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
