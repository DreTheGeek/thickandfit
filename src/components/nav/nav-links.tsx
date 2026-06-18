'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/lib/auth/actions';
import type { Role } from '@/lib/auth/session';

const COACH_ROLES: Role[] = ['coach', 'assistant_coach', 'operator'];

const BASE_LINKS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/exercises', label: 'Exercises' },
  { href: '/history', label: 'History' },
];

const COACH_LINKS = [{ href: '/coach/programs', label: 'Programs' }];

interface NavLinksProps {
  role: Role;
}

export function NavLinks({ role }: NavLinksProps) {
  const pathname = usePathname();
  const isCoach = COACH_ROLES.includes(role);
  const links = isCoach ? [...BASE_LINKS, ...COACH_LINKS] : BASE_LINKS;

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-black text-white">
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
        <Link
          href="/dashboard"
          className="font-display text-2xl uppercase leading-none tracking-wide text-white"
        >
          Thick &amp; Fit
        </Link>
        <span className="mb-2 h-1.5 w-1.5 rounded-full bg-olive" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {links.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center border-l-2 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-colors',
                active
                  ? 'border-olive bg-white/5 text-white'
                  : 'border-transparent text-white/45 hover:bg-white/5 hover:text-white',
              ].join(' ')}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.15em] text-white/40 transition-colors hover:text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
