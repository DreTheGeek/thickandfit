'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { signOutAction } from '@/lib/auth/actions';
import { Wordmark } from '@/components/ui/wordmark';
import { Icon, type IconName } from '@/components/ui/icons';

type NavItem = { key: string; href: string; icon: IconName };
type NavSection = { headerKey: string; items: NavItem[] };

// Admin portal IA, reorganized from Lenus's flat "Toolbox" into clear sections. Trimmed to shipped
// routes only (WP9): Phase-3 admin tooling is kept out of the product entirely rather than badged
// "soon", so every visible item routes to a real, data-bound screen.
const SECTIONS: NavSection[] = [
  {
    headerKey: 'overview',
    items: [
      { key: 'navHome', href: '/coach', icon: 'home' },
      { key: 'navBilling', href: '/coach/billing', icon: 'card' },
    ],
  },
  {
    headerKey: 'navClients',
    items: [
      { key: 'navClients', href: '/coach/clients', icon: 'user' },
      { key: 'navLeads', href: '/coach/leads', icon: 'funnel' },
      { key: 'navInbox', href: '/coach/inbox', icon: 'chat' },
      { key: 'navCommunity', href: '/coach/community', icon: 'community' },
      { key: 'navChallenges', href: '/coach/challenges', icon: 'community' },
    ],
  },
  {
    // Mid-ticket coaching (WP8). drafts = assistant-facing; approvals + assignments are approver-facing
    // and redirect non-approvers at the page level (requireApprover), so the links are role-agnostic.
    headerKey: 'navMidTicket',
    items: [
      { key: 'navDrafts', href: '/coach/drafts', icon: 'file' },
      { key: 'navApprovals', href: '/coach/approvals', icon: 'clipboard' },
      { key: 'navAssignments', href: '/coach/assignments', icon: 'user' },
    ],
  },
  {
    headerKey: 'bucketTraining',
    items: [
      { key: 'programs', href: '/coach/programs', icon: 'clipboard' },
      { key: 'toolExercises', href: '/coach/exercises', icon: 'dumbbell' },
    ],
  },
  {
    headerKey: 'bucketNutrition',
    items: [
      { key: 'toolRecipes', href: '/coach/tool/recipes', icon: 'nutrition' },
      { key: 'toolRecipeBooks', href: '/coach/tool/recipe-books', icon: 'book' },
      { key: 'toolMealPlans', href: '/coach/tool/meal-plans', icon: 'nutrition' },
    ],
  },
  {
    headerKey: 'bucketContent',
    items: [{ key: 'forms', href: '/coach/forms', icon: 'file' }],
  },
  {
    headerKey: 'navSettings',
    items: [
      { key: 'navSettings', href: '/coach/settings', icon: 'gear' },
      { key: 'navKnowledge', href: '/coach/settings/knowledge', icon: 'sparkles' },
      { key: 'appHealth', href: '/coach/health', icon: 'pulse' },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/coach') return pathname === '/coach';
  return pathname === href || pathname.startsWith(href + '/');
}

export function CoachNav({ onNavigate }: { onNavigate?: () => void }): ReactElement {
  const pathname = usePathname();
  const t = useTranslations('app.coach');
  const c = useTranslations('app.common');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
        <Link href="/coach" onClick={onNavigate} className="tf-display text-[22px] text-ink">
          Thick &amp; Fit
        </Link>
      </div>

      <nav className="tf-scroll flex-1 overflow-y-auto px-3 py-3">
        {SECTIONS.map((section) => {
          const open = !collapsed.has(section.headerKey);
          const hasActive = section.items.some((it) => isActive(pathname, it.href));
          return (
            <div key={section.headerKey} className="mb-1">
              <button
                type="button"
                onClick={() => toggle(section.headerKey)}
                className="flex w-full items-center justify-between px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[1.5px] text-faint"
              >
                <span className={hasActive ? 'text-muted' : ''}>{t(section.headerKey)}</span>
                <Icon
                  name="chevronRight"
                  size={12}
                  className={['transition-transform', open ? 'rotate-90' : ''].join(' ')}
                />
              </button>
              {open &&
                section.items.map((it) => {
                  const active = isActive(pathname, it.href);
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={onNavigate}
                      className={[
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                        active ? 'bg-warm font-semibold text-ink' : 'text-muted hover:bg-warm/60 hover:text-ink',
                      ].join(' ')}
                    >
                      <Icon name={it.icon} size={16} />
                      {t(it.key)}
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-full px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
          >
            {c('signOut')}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Mobile-only wordmark fallback shown in the top bar. */
export function CoachTopWordmark(): ReactElement {
  return <Wordmark height={20} />;
}
