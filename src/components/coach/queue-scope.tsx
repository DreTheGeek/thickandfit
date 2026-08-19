// "Mine" / "Everyone" on a coach queue.
//
// TWO LINKS, NOT A CLIENT COMPONENT. The filter is a URL parameter the page reads, so the answer is
// computed on the server with the same resolver the guards use, it survives a refresh and a shared
// link, and there is no second definition of "mine" living in the browser.
//
// RENDERED ONLY WHEN SOMETHING IS ASSIGNED. Nothing is assigned today — all 256 migrating members
// belong to the company — so a "mine" filter would show an empty console, and an empty console is
// the failure this whole area of the app is trying to prevent. The toggle appears the day a client
// gets an owner.
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

export async function QueueScope({
  basePath,
  mine,
  visible,
}: {
  basePath: string;
  mine: boolean;
  /** Pass CoverageContext.anyAssigned. False hides the control entirely. */
  visible: boolean;
}): Promise<ReactElement | null> {
  if (!visible) return null;
  const t = await getTranslations('app.coach');
  const on = 'bg-ink text-bg';
  const off = 'border border-line text-muted';
  return (
    <div className="mb-4 flex gap-2">
      <Link
        href={basePath}
        className={`tf-press rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${mine ? off : on}`}
      >
        {t('filterEveryone')}
      </Link>
      <Link
        href={`${basePath}?mine=1`}
        className={`tf-press rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${mine ? on : off}`}
      >
        {t('filterMine')}
      </Link>
    </div>
  );
}
