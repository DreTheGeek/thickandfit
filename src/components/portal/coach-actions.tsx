import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Icon, type IconName } from '@/components/ui/icons';

/**
 * The handoff's `.coach-actions`: three pills under the coach thread.
 *
 * They are the best thing on that screen in the mock and they were the cheapest thing in it, which
 * is a bad combination to leave unbuilt. Every one is a link to a route that already exists, so
 * this is pure navigation: no new data, no new action, no state.
 *
 * What they change is what the screen IS. A chat is a place you wait for a reply; a chat with these
 * is a launcher. The three are the things a member most often opens the thread to ask about, so the
 * pills answer two of the questions before she types them.
 *
 * Server component on purpose. It holds no state and both Coach routes are server-rendered, so
 * making it a client component would ship JavaScript to render three anchors.
 */
const ACTIONS: { key: string; href: string; icon: IconName }[] = [
  { key: 'actionLogFood', href: '/nutrition', icon: 'nutrition' },
  { key: 'actionCheckin', href: '/checkin', icon: 'clipboard' },
  { key: 'actionViewPlan', href: '/workouts', icon: 'dumbbell' },
];

export async function CoachActions(): Promise<ReactElement> {
  const t = await getTranslations('app.you');
  return (
    <div className="tf-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
      {ACTIONS.map((a) => (
        <Link
          key={a.key}
          href={a.href}
          className="tf-press flex flex-none items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[12px] font-semibold text-soft"
        >
          <Icon name={a.icon} size={13} />
          {t(a.key)}
        </Link>
      ))}
    </div>
  );
}
