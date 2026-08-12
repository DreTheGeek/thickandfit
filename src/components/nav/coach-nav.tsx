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

// The coaching console, grouped the way Stephanie's previous platform grouped it, because that
// grouping is the one she already has in her hands: Dashboard, Clients, Leads, Chat, Toolbox,
// Settings. Trimmed to shipped routes only (WP9): tooling that does not exist yet is left out
// entirely rather than badged "soon", so every visible item routes to a real, data-bound screen.
//
// TOOLBOX IS ONE FLAT LIST ON PURPOSE. It used to be split three ways (Training / Nutrition /
// Content & Check-ins), which is our taxonomy, not hers: she scans a single alphabetical list and
// picks. The order below is her list's order for the items we have, so the relative positions she
// learned still hold. Programs sits where "training templates" sat, at the end, not under P.
//
// SCOPE RULE for anything added here: this portal is about PEOPLE and PROGRAMMING. A number about a
// woman belongs here; a number about the system belongs in the operator portal on the admin. host.
// Scan accuracy, model latency and service probes used to live here (navIntelligence, appHealth) and
// were moved to /admin/intelligence and /admin/health for exactly that reason.
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
      // App accounts, as distinct from CRM contacts above: a woman who signed up but has not finished
      // onboarding has a profile and no contact row, so she appears here and nowhere else. This was
      // reachable only by deep link before, which is why /coach/subscribers/[id]'s back button led to
      // a page with no way in.
      { key: 'navMembers', href: '/coach/subscribers', icon: 'community' },
      // Sits directly under Clients on purpose: it is a queue about specific new members, and the
      // whole point of over-flagging in the extractor is that a human passes by here.
      { key: 'navIntake', href: '/coach/intake', icon: 'clipboard' },
      // The other half of the same promise. Intake is "read what she wrote"; this is "she is still
      // waiting on the plan we told her you were writing". Adjacent because they are the same member
      // on the same day, and separating them by three sections is how one of them gets forgotten.
      { key: 'navAwaiting', href: '/coach/awaiting', icon: 'clipboard' },
      // Leads is a sibling of Clients on her old top-level nav, not a child. It stays in this
      // section rather than getting a header of its own, because a one-item section is a header
      // with nothing under it.
      { key: 'navLeads', href: '/coach/leads', icon: 'funnel' },
    ],
  },
  {
    // Her word is Chat, so the item is Chat. Community and Challenges join it because all three are
    // "talking to people", and neither is the group-programming surface her Client groups was.
    headerKey: 'navInbox',
    items: [
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
    headerKey: 'bucketToolbox',
    items: [
      { key: 'toolExercises', href: '/coach/exercises', icon: 'dumbbell' },
      // Beside the exercise library because it is a job about that library, but deliberately NOT at
      // /coach/exercises/spanish: isActive() matches on prefix, so a child route of an item already
      // in this list lights up both rows at once.
      { key: 'navSpanish', href: '/coach/spanish', icon: 'book' },
      { key: 'forms', href: '/coach/forms', icon: 'file' },
      { key: 'toolMealPlans', href: '/coach/tool/meal-plans', icon: 'nutrition' },
      { key: 'toolRecipeBooks', href: '/coach/tool/recipe-books', icon: 'book' },
      { key: 'toolRecipes', href: '/coach/tool/recipes', icon: 'nutrition' },
      { key: 'programs', href: '/coach/programs', icon: 'clipboard' },
    ],
  },
  {
    headerKey: 'navSettings',
    items: [
      { key: 'navSettings', href: '/coach/settings', icon: 'gear' },
      // The two preference screens carried over from the platform she is leaving. Listed separately
      // rather than buried inside /coach/settings because that is where she expects to find them:
      // one click from the sidebar, not one click plus a hunt down a page of account cards.
      { key: 'navClientApp', href: '/coach/settings/client-app', icon: 'grid' },
      { key: 'navCoachingPrefs', href: '/coach/settings/coaching', icon: 'ruler' },
      { key: 'navKnowledge', href: '/coach/settings/knowledge', icon: 'sparkles' },
      // Sits beside the knowledge base because that is where she teaches it; this is where she sees
      // what it did with what she taught.
      { key: 'navMethod', href: '/coach/method', icon: 'pulse' },
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
