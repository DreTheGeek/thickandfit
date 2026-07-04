'use client';
// Support ticket board: log a ticket + move tickets through open -> in_progress -> resolved.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { createTicketAction, setTicketStatusAction } from '@/lib/admin/support-actions';
import type { Ticket } from '@/lib/admin/portal';

const STATUSES: Ticket['status'][] = ['open', 'in_progress', 'resolved', 'closed'];
const NEXT: Record<string, Ticket['status']> = { open: 'in_progress', in_progress: 'resolved', resolved: 'closed', closed: 'open' };

export function SupportBoard({ tickets }: { tickets: Ticket[] }): ReactElement {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [pending, start] = useTransition();

  const add = (): void => {
    if (!subject.trim() || pending) return;
    start(async () => {
      const res = await createTicketAction({ subject, email });
      if (res.ok) { setSubject(''); setEmail(''); router.refresh(); }
    });
  };
  const advance = (t: Ticket): void => {
    start(async () => {
      const res = await setTicketStatusAction({ id: t.id, status: NEXT[t.status] });
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">Log a ticket</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Member email (optional)" className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink" />
          <button type="button" onClick={add} disabled={pending || !subject.trim()} className="tf-press rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-surface disabled:opacity-40">Add</button>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3 text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">Tickets</div>
        {tickets.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-faint">No tickets. Member support requests will land here.</p>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 border-b border-divider px-5 py-3 text-[13px] last:border-0">
              <div className="min-w-0">
                <div className="font-medium text-ink">{t.subject}</div>
                <div className="text-[11px] text-faint">{t.email ?? 'no email'} · {t.priority}{t.category ? ` · ${t.category}` : ''}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-warm px-2 py-0.5 text-[10px] font-semibold uppercase text-soft">{t.status.replace('_', ' ')}</span>
                <button type="button" onClick={() => advance(t)} disabled={pending} className="tf-press rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-muted hover:border-ink hover:text-ink disabled:opacity-40">
                  → {NEXT[t.status].replace('_', ' ')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <p className="text-[11px] text-faint">Statuses: {STATUSES.join(' → ')}. Tickets also arrive automatically once a member support form or email intake is wired.</p>
    </div>
  );
}
