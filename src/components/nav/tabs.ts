// The member app's navigation, defined ONCE.
//
// This list was hand-duplicated in bottom-nav.tsx (phone) and subscriber-rail.tsx (lg+), and the two
// copies drifted: the phone got the handoff's six tabs, the rail kept five in a different order,
// folded Progress inside You, and carried the coach thread as a loose row underneath. So the same
// member on the same URL saw a different tab lit depending on her screen width, and every desktop
// screenshot taken while the 8.0 work was in flight showed a nav that disagreed with the design.
//
// subscriber-rail.tsx's own comment predicted this and asked for one definition if a third copy ever
// appeared. This is that definition, arriving one copy early.
//
// `match` rather than a bare href because several routes belong to a tab that does not own their
// path: /evolution is the Progress story over a longer window, /coach-chat and /messages are both
// the coach, and /workout/ is a session inside Train.
import type { IconName } from '@/components/ui/icons';

export type TabKey = 'today' | 'activities' | 'nutrition' | 'progress' | 'community' | 'coach';

export type Tab = {
  /** Also the i18n key under `app.nav`. */
  key: TabKey;
  href: string;
  icon: IconName;
  match: (path: string) => boolean;
};

/**
 * Six tabs, per the 8.0 handoff (.planning/design_handoff/8.0/client-portal.html).
 *
 * The old nav had five and buried Progress and the coach thread inside the You hub. Five of the six
 * screens in the handoff draw the same bar: Today, Train, Fuel, Progress, Community, Coach. The
 * Profile screen draws a seventh tab in Coach's place, which is the one internal contradiction in
 * the handoff; Coach wins because it is what the other five agree on, and because a coaching product
 * should not put its coach two taps deep. Profile is reached from the header, and on the rail from
 * its own row below this list.
 */
export const TABS: Tab[] = [
  { key: 'today', href: '/dashboard', icon: 'calendar', match: (p) => p === '/dashboard' },
  {
    key: 'activities',
    href: '/workouts',
    icon: 'dumbbell',
    match: (p) =>
      p.startsWith('/workouts') ||
      p.startsWith('/exercises') ||
      p.startsWith('/workout/') ||
      p.startsWith('/history'),
  },
  {
    key: 'nutrition',
    href: '/nutrition',
    icon: 'nutrition',
    match: (p) => p.startsWith('/nutrition'),
  },
  {
    key: 'progress',
    href: '/progress',
    icon: 'pulse',
    // Progress owns the body-and-photos story, which the handoff splits across a Progress screen and
    // a Photos screen reached from its own tab row. /evolution is the same story over a longer
    // window, so it lights this tab rather than none.
    match: (p) => p.startsWith('/progress') || p.startsWith('/evolution'),
  },
  {
    key: 'community',
    href: '/community',
    icon: 'community',
    match: (p) => p.startsWith('/community'),
  },
  {
    key: 'coach',
    href: '/inbox',
    icon: 'chat',
    // /inbox is the human thread with Stephanie, which is the conversation the handoff's Coach screen
    // draws. /coach-chat is the assistant and lives behind the same tab: from a member's side both
    // are "talking to my coach", and giving them separate tabs would ask her to know which one she
    // wants before she has typed anything.
    match: (p) => p.startsWith('/inbox') || p.startsWith('/coach-chat') || p.startsWith('/messages'),
  },
];

/**
 * Immersive flows hide the nav entirely, on both surfaces.
 *
 * /workout/ is separate from the list because it is a prefix match on a session route, not a
 * standalone page: the player takes the whole screen and the member is mid-set.
 */
const HIDDEN = ['/onboarding', '/checkin'];

export function isNavHidden(path: string): boolean {
  return HIDDEN.some((h) => path.startsWith(h)) || path.startsWith('/workout/');
}
