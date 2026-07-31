'use client';
// Support ticket board: log a ticket + read it + move it through open -> in_progress -> resolved.
//
// The board previously rendered ONLY the subject line. support_tickets.body was written on create
// and never selected, so a ticket could not be opened and therefore could not be worked: you could
// see that someone needed help but not what they needed. Rows now expand in place.
//
// Expand-in-place rather than a detail route: the whole point is triage, and bouncing to a separate
// page per ticket and back is worse than reading three of them in a row.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { createTicketAction, setTicketStatusAction } from '@/lib/admin/support-actions';
import type { Ticket } from '@/lib/admin/portal';

const STATUSES: Ticket['status'][] = ['open', 'in_progress', 'resolved', 'closed'];
const NEXT: Record<string, Ticket['status']> = { open: 'in_progress', in_progress: 'resolved', resolved: 'closed', closed: 'open' };
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const CATEGORIES = ['billing', 'account', 'bug', 'content', 'other'] as const;

const inputClass =
  'min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink';

export function SupportBoard({ tickets }: { tickets: Ticket[] }): ReactElement {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('normal');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('other');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = (): void => {
    if (!subject.trim() || pending) return;
    start(async () => {
      const res = await createTicketAction({ subject, email, body, priority, category });
      if (res.ok) {
        setSubject('');
        setEmail('');
        setBody('');
        setPriority('normal');
        setCategory('other');
        router.refresh();
      }
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
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={inputClass} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Member email (optional)" className={inputClass} />
          </div>
          {/* The field that was missing entirely. Without it every manually logged ticket was a
              headline with no substance, which is exactly what made the board unusable. */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened? Steps, error text, order number, anything you would need to fix it."
            rows={3}
            className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={priority} onChange={(e) => setPriority(e.target.value as (typeof PRIORITIES)[number])} className={inputClass}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{`Priority: ${p}`}</option>
              ))}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{`Category: ${c}`}</option>
              ))}
            </select>
            <button type="button" onClick={add} disabled={pending || !subject.trim()} className="tf-press shrink-0 rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-surface disabled:opacity-40">
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3 text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">Tickets</div>
        {tickets.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-faint">No tickets. Member support requests will land here.</p>
        ) : (
          tickets.map((t) => {
            const isOpen = openId === t.id;
            return (
              <div key={t.id} className="border-b border-divider last:border-0">
                <div className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : t.id)}
                    aria-expanded={isOpen}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-ink">
                      <span aria-hidden className={`text-[10px] text-faint transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                      <span className="truncate">{t.subject}</span>
                    </div>
                    <div className="mt-0.5 pl-4 text-[11px] text-faint">
                      {t.email ?? 'no email'} · {t.priority}
                      {t.category ? ` · ${t.category}` : ''} · {formatWhen(t.createdAt)}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-warm px-2 py-0.5 text-[10px] font-semibold uppercase text-soft">{t.status.replace('_', ' ')}</span>
                    <button type="button" onClick={() => advance(t)} disabled={pending} className="tf-press rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-muted hover:border-ink hover:text-ink disabled:opacity-40">
                      → {NEXT[t.status].replace('_', ' ')}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-divider px-5 py-4 pl-9">
                    {t.body ? (
                      // whitespace-pre-wrap: a pasted error or a numbered repro loses all meaning if
                      // its line breaks collapse.
                      <p className="whitespace-pre-wrap text-[13px] leading-[1.6] text-soft">{t.body}</p>
                    ) : (
                      <p className="text-[13px] italic text-faint">
                        No details were captured on this ticket. Tickets logged before the description field existed
                        have only a subject.
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
                      <span>Source: {t.source ?? 'manual'}</span>
                      {t.email ? (
                        <a href={`mailto:${t.email}?subject=${encodeURIComponent(`Re: ${t.subject}`)}`} className="underline underline-offset-2 hover:text-ink">
                          Reply to {t.email}
                        </a>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <p className="text-[11px] text-faint">Statuses: {STATUSES.join(' → ')}. Tickets also arrive automatically once a member support form or email intake is wired.</p>
    </div>
  );
}

/** "Jul 30, 8:16 PM". Rendered client-side, so it uses the operator's own timezone. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
