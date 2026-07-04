// Small shared building blocks for the admin portal pages (server components; English-only ops tool).
import type { ReactElement, ReactNode } from 'react';

export function AdminPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }): ReactElement {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <h1 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-1 text-[13px] text-muted">{subtitle}</p> : null}
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </div>
  );
}

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }): ReactElement {
  return (
    <section className="rounded-2xl border border-line bg-surface">
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad' }): ReactElement {
  const color = tone === 'bad' ? 'text-[#B4462F]' : tone === 'warn' ? 'text-[#B98A1C]' : tone === 'good' ? 'text-[#1F7A46]' : 'text-ink';
  return (
    <div className="rounded-xl border border-line bg-bg px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[1.2px] text-faint">{label}</div>
      <div className={`mt-1 font-display text-2xl ${color}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-faint">{sub}</div> : null}
    </div>
  );
}

export function Dot({ ok }: { ok: boolean }): ReactElement {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ok ? '#1F7A46' : '#B4462F' }} aria-hidden />;
}

export function Row({ left, right }: { left: ReactNode; right: ReactNode }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider py-2.5 text-[13px] last:border-0">
      <div className="min-w-0">{left}</div>
      <div className="shrink-0 text-right">{right}</div>
    </div>
  );
}
