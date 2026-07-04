'use client';
// Self-contained operator/admin portal shell. Its OWN sidebar (no coaching-console links), viewport
// height so nav scrolls internally and Sign out is always pinned + visible without scrolling. Internal
// ops tool: English-only by design.
import { useState, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/icons';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { signOutAction } from '@/lib/auth/actions';

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin', label: 'Overview', icon: 'grid' },
  { href: '/admin/health', label: 'System health', icon: 'pulse' },
  { href: '/admin/connections', label: 'Connections', icon: 'bolt' },
  { href: '/admin/api', label: 'API analytics', icon: 'pulse' },
  { href: '/admin/traces', label: 'Agent traces', icon: 'sparkles' },
  { href: '/admin/evals', label: 'Evals', icon: 'clipboard' },
  { href: '/admin/usage', label: 'AI usage & spend', icon: 'sparkles' },
  { href: '/admin/status', label: 'Status & crons', icon: 'refresh' },
  { href: '/admin/support', label: 'Support tickets', icon: 'chat' },
  { href: '/admin/learning', label: 'AI learning', icon: 'sparkles' },
  { href: '/admin/graph', label: 'Knowledge graph', icon: 'grid' },
  { href: '/admin/knowledge', label: 'Knowledge base', icon: 'book' },
  { href: '/admin/qa', label: 'Launch QA board', icon: 'clipboard' },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }): ReactElement {
  return (
    <>
      {NAV.map((n) => {
        const active = n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={[
              'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
              active ? 'bg-ink text-surface' : 'text-muted hover:bg-warm/50 hover:text-ink',
            ].join(' ')}
          >
            <Icon name={n.icon} size={16} />
            {n.label}
          </Link>
        );
      })}
    </>
  );
}

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }): ReactElement {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-5">
        <span className="font-display text-lg uppercase tracking-tight">Admin</span>
        <span className="rounded-full bg-warm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-soft">Ops</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
      </nav>
      <div className="shrink-0 space-y-1 border-t border-line p-3">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Theme</span>
          <ThemeToggle />
        </div>
        <form action={signOutAction}>
          <button type="submit" className="tf-press w-full rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface lg:sticky lg:top-0 lg:block lg:h-screen">
        <Sidebar pathname={pathname} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
          <span className="font-display text-base uppercase tracking-tight">Admin</span>
          <button type="button" aria-label="Menu" onClick={() => setOpen(true)} className="tf-press text-ink">
            <Icon name="menu" size={24} />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="absolute left-0 top-0 h-full w-64 max-w-[80%] bg-surface shadow-xl">
            <Sidebar pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
