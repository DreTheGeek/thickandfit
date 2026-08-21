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

/**
 * The coaching console sidebar: 16 rows, down from 26.
 *
 * THE COMPLAINT: "a lot of the stuff on the side tab could have been put into fewer tabs because
 * those are a lot a lot of fucking tabs on the side... this should need to be ADHD friendly. I'm
 * not gonna lie. This gonna stress her the fuck out. Like, you got meal plans, recipe books, and
 * recipes. All that could have been in one tab."
 *
 * NOTHING WAS DELETED. Ten screens moved from being their own sidebar row to being a TAB on the row
 * of the group they belong to (components/coach/section-tabs.tsx). Every route still exists, still
 * has its own URL, still loads its own data. What changed is that the sidebar now answers "what am
 * I doing" rather than "what screens exist", and near-neighbours filed as strangers are back
 * together:
 *
 *   Needs you    awaiting + intake + quiet + plan-renewals   one question, four queues
 *   People       clients + members + leads                   clients vs members was a real
 *                                                            confusion, not just a long list
 *   Training     programs + exercises + spanish
 *   Nutrition    meal plans + recipes + recipe books         named by the owner
 *   Approvals    approvals + drafts + assignments
 *   Assistant    method + knowledge
 *
 * The two settings children (client-app, coaching prefs) also lose their rows. They were promoted
 * out of /coach/settings so she would not have to hunt for them; the settings page lists them both
 * at the top, and two extra rows in a sidebar she finds overwhelming is the more expensive problem.
 *
 * Each group's row points at the FIRST tab, so the landing screen and the leftmost tab agree.
 *
 * SCOPE RULE for anything added here: this portal is about PEOPLE and PROGRAMMING. A number about a
 * woman belongs here; a number about the system belongs in the operator portal on the admin. host.
 * Scan accuracy, model latency and service probes live at /admin/intelligence and /admin/health.
 *
 * Before adding a row, ask whether it is a TAB on a row that already exists. That is how the list
 * got to 26.
 */
const SECTIONS: NavSection[] = [
  {
    headerKey: 'overview',
    items: [
      { key: 'navHome', href: '/coach', icon: 'home' },
      // The four member queues. Intake is "read what she wrote", awaiting is "she is still waiting
      // on the plan we promised", quiet is "she stopped waiting", renewals is "hers is finishing".
      // Same woman at four points, so one row.
      { key: 'navNeedsYou', href: '/coach/awaiting', icon: 'clipboard' },
    ],
  },
  {
    headerKey: 'navClients',
    items: [
      { key: 'navPeople', href: '/coach/clients', icon: 'user' },
      { key: 'navBilling', href: '/coach/billing', icon: 'card' },
      // Not a queue: nothing accumulates in either. They sit together because both are things you
      // set BEFORE a date and then stop thinking about, and a rota buried in a settings tree is a
      // rota nobody fills in.
      { key: 'navCoverage', href: '/coach/coverage', icon: 'user' },
      { key: 'navCampaigns', href: '/coach/campaigns', icon: 'funnel' },
    ],
  },
  {
    // Her word is Chat, so the item is Chat. Community and Challenges join it because all three are
    // "talking to people".
    headerKey: 'navInbox',
    items: [
      { key: 'navInbox', href: '/coach/inbox', icon: 'chat' },
      { key: 'navCommunity', href: '/coach/community', icon: 'community' },
      { key: 'navChallenges', href: '/coach/challenges', icon: 'community' },
    ],
  },
  {
    headerKey: 'bucketLibrary',
    items: [
      { key: 'navTraining', href: '/coach/programs', icon: 'dumbbell' },
      { key: 'navNutrition', href: '/coach/tool/meal-plans', icon: 'nutrition' },
      { key: 'toolLessons', href: '/coach/tool/lessons', icon: 'book' },
      { key: 'forms', href: '/coach/forms', icon: 'file' },
    ],
  },
  {
    headerKey: 'navSettings',
    items: [
      // Mid-ticket coaching (WP8). approvals + assignments are approver-facing and redirect
      // non-approvers at the page level (requireApprover), so the link is role-agnostic.
      { key: 'navApprovals', href: '/coach/approvals', icon: 'clipboard' },
      { key: 'navAssistant', href: '/coach/method', icon: 'sparkles' },
      // The checklist and the written manual. "A new coach is lost when they open this software."
      { key: 'navGettingStarted', href: '/coach/getting-started', icon: 'book' },
      { key: 'navSettings', href: '/coach/settings', icon: 'gear' },
    ],
  },
];

/**
 * The screens each grouped row stands for.
 *
 * A row now points at the FIRST tab of its group, so without this, opening /coach/quiet from the
 * "Needs you" tabs would leave the sidebar highlighting nothing and the console would read as
 * having navigated somewhere off the map. Keyed by the row's href, and it must stay in step with
 * lib/coach/section-tabs.ts, which is the list the tabs themselves are built from.
 */
const GROUPS: Record<string, string[]> = {
  '/coach/awaiting': ['/coach/awaiting', '/coach/intake', '/coach/quiet', '/coach/plan-renewals'],
  '/coach/clients': ['/coach/clients', '/coach/subscribers', '/coach/leads', '/coach/invites'],
  '/coach/programs': ['/coach/programs', '/coach/exercises', '/coach/spanish'],
  '/coach/tool/meal-plans': ['/coach/tool/meal-plans', '/coach/tool/recipes', '/coach/tool/recipe-books'],
  '/coach/approvals': ['/coach/approvals', '/coach/drafts', '/coach/assignments'],
  '/coach/method': ['/coach/method', '/coach/settings/knowledge'],
  '/coach/getting-started': ['/coach/getting-started', '/coach/training'],
};

function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/coach') return pathname === '/coach';
  const group = GROUPS[href];
  if (group) {
    // Longest first, so /coach/settings/knowledge is not claimed by a shorter sibling elsewhere.
    return group.some((h) => matches(pathname, h));
  }
  // A row that is NOT a group entry must not claim a path some group owns. /coach/settings would
  // otherwise light up on /coach/settings/knowledge, which belongs to Assistant.
  const ownedElsewhere = Object.entries(GROUPS).some(
    ([entry, members]) => entry !== href && members.some((h) => h !== href && matches(pathname, h) && h.startsWith(href + '/')),
  );
  if (ownedElsewhere) return false;
  return matches(pathname, href);
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
