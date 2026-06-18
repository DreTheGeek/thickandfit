'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/lib/auth/actions';
import type { Role } from '@/lib/auth/session';

const COACH_ROLES: Role[] = ['coach', 'assistant_coach', 'operator'];

const BASE_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/exercises', label: 'Exercises' },
  { href: '/history', label: 'History' },
];

const COACH_LINKS = [
  { href: '/coach/programs', label: 'Programs' },
];

interface NavLinksProps {
  role: Role;
}

export function NavLinks({ role }: NavLinksProps) {
  const pathname = usePathname();
  const isCoach = COACH_ROLES.includes(role);

  const links = isCoach ? [...BASE_LINKS, ...COACH_LINKS] : BASE_LINKS;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-100 bg-white">
      <div className="flex h-14 items-center border-b border-neutral-100 px-4">
        <Link href="/dashboard" className="text-sm font-black uppercase tracking-widest text-black">
          Thick &amp; Fit
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {links.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors',
                active
                  ? 'bg-black text-white'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-black',
              ].join(' ')}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-100 p-3">
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full px-3 py-2.5 text-left text-xs font-bold uppercase tracking-widest text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-black"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
