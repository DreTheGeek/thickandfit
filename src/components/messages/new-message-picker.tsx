'use client';
// "New message" client picker for the coach inbox: search all clients, pick one -> open their thread.
import { useMemo, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';

export function NewMessagePicker({
  clients,
}: {
  clients: { contactId: string; name: string; hasAccount: boolean }[];
}): ReactElement {
  const router = useRouter();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? clients.filter((c) => c.name.toLowerCase().includes(needle)) : clients;
    return base.slice(0, 200);
  }, [q, clients]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-4">
        <h2 className="mb-2 font-display text-lg uppercase tracking-tight">New message</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients..."
          autoFocus
          className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-[14px] outline-none focus:border-ink"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-[13px] text-faint">No clients match.</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.contactId}
              type="button"
              onClick={() => router.push(`/coach/inbox?c=${c.contactId}`)}
              className="flex w-full items-center justify-between gap-2 border-b border-divider px-4 py-3 text-left hover:bg-warm/40"
            >
              <span className="truncate text-[14px] font-medium text-ink">{c.name}</span>
              {!c.hasAccount && <span className="shrink-0 rounded-full bg-warm px-2 py-0.5 text-[10px] font-semibold uppercase text-soft">email</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
