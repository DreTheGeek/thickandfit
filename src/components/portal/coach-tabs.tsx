'use client';
// The Coach screen's two tabs, shared by both routes so they read as one screen.
//
// The handoff draws ONE Coach screen. This app has two threads and they are genuinely different
// things: /inbox is a real message to Stephanie, answered when she gets to it, and /coach-chat
// answers immediately in her voice. Merging them into a single list was rejected deliberately: the
// two message stores have different shapes and different send paths, and blurring "am I talking to
// a person" is the wrong thing to blur in a coaching product a member pays for.
//
// So: two tabs, one screen. LINKS rather than local state, because each thread already has a route
// that loads its own history server-side; rendering both in one page would mean loading both every
// time she opens either. bottom-nav.tsx already treats them as one destination and lights the Coach
// tab for both, with the reasoning written there.
//
// The labels avoid the word this brand does not use. "Steph" is the person; the other is her coach,
// which is literally what it is, and the standing line inside that screen already says "Your coach,
// in Stephanie's voice".
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { PortalTabs } from '@/components/portal/portal-chrome';

type CoachTab = 'steph' | 'coach';

export function CoachTabs(): ReactElement {
  const t = useTranslations('app.you');
  const pathname = usePathname();
  const value: CoachTab = pathname.startsWith('/coach-chat') ? 'coach' : 'steph';

  return (
    <PortalTabs<CoachTab>
      value={value}
      variant="grid"
      options={[
        { value: 'steph', label: t('coachTabSteph') },
        { value: 'coach', label: t('coachTabAssistant') },
      ]}
      hrefFor={(v) => (v === 'coach' ? '/coach-chat' : '/inbox')}
    />
  );
}
