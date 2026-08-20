import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';

/**
 * The contract's `.coach-head`: a 40px round photo, her name, and one line under it.
 *
 * The photo is HER, from public/brand/shoot, not a stock portrait. The handoff points it at an
 * Unsplash model for the same reason it points the workout images there, and the same answer
 * applies: this is the one screen where a member is talking to a specific person, so a stranger's
 * face above the name "Coach Steph" is the worst possible place for a placeholder.
 *
 * THE SUB-LINE IS NOT "Online", and this is the single deliberate departure from the contract's
 * copy. Nothing in this app tracks presence: there is no heartbeat, no last-seen, no socket. The
 * word would be decoration that reads as a promise, and the member it misleads is the one who
 * messages at 11pm and waits up for a reply that was never coming. One coach, 256 members, two
 * time zones.
 *
 * What goes there instead is true and does the same job the design wanted the line to do, which is
 * to set an expectation about the reply. If presence is ever really tracked, this is the one string
 * to change.
 */
export async function CoachHead(): Promise<ReactElement> {
  const t = await getTranslations('app.you');
  return (
    <div className="mb-3 flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no layout shift */}
      <img
        src="/brand/shoot/atlanta-profile.avif"
        alt=""
        className="h-10 w-10 flex-none rounded-full object-cover"
      />
      <div className="min-w-0">
        <strong className="block truncate text-[14px] leading-tight">{t('coachName')}</strong>
        <small className="block text-muted">{t('coachReplyExpectation')}</small>
      </div>
    </div>
  );
}
