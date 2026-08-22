'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { markAllReadAction, markReadAction } from '@/lib/notifications/actions';
import { PushOptIn } from '@/components/notifications/push-opt-in';
import type { AppNotification } from '@/lib/notifications/types';

function timeAgo(iso: string, t: ReturnType<typeof useTranslations>): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('justNow');
  if (min < 60) return t('minutesAgo', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('hoursAgo', { n: hr });
  const day = Math.floor(hr / 24);
  return t('daysAgo', { n: day });
}

export function NotificationList({
  initial,
  pushConfigured,
  vapidPublicKey,
}: {
  initial: AppNotification[];
  pushConfigured: boolean;
  vapidPublicKey: string;
}): ReactElement {
  const t = useTranslations('app.notifications');
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  const hasUnread = items.some((n) => n.readAt === null);

  function markOne(id: string): void {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    startTransition(async () => {
      await markReadAction(id);
      router.refresh();
    });
  }

  function markAll(): void {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    startTransition(async () => {
      await markAllReadAction();
      router.refresh();
    });
  }

  return (
    <div>
      {pushConfigured ? <PushOptIn vapidPublicKey={vapidPublicKey} /> : null}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{t('count', { n: items.length })}</p>
        <button
          type="button"
          onClick={markAll}
          disabled={!hasUnread}
          className="text-[12px] font-semibold uppercase tracking-[0.12em] text-accent disabled:opacity-30"
        >
          {t('markAll')}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-warm/50 px-5 py-12 text-center">
          <p className="text-sm text-muted">{t('empty')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const unread = n.readAt === null;
            const inner = (
              <div
                className={[
                  'flex items-start gap-3 rounded-2xl px-4 py-3.5 transition-colors',
                  unread ? 'bg-warm' : 'bg-surface hover:bg-warm/40',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className={[
                    'mt-1.5 h-2 w-2 flex-none rounded-full',
                    unread ? 'bg-accent' : 'bg-transparent',
                  ].join(' ')}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">{n.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{n.body}</p>
                  {/* Relative to NOW, which the server and the browser evaluate at different
                      moments, so "2 minutes ago" can hydrate as "3 minutes ago". Same guard
                      community-feed.tsx already carries for exactly this. */}
                  <p suppressHydrationWarning className="mt-1 text-[11px] uppercase tracking-[0.1em] text-faint">
                    {timeAgo(n.createdAt, t)}
                  </p>
                </div>
              </div>
            );

            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} onClick={() => unread && markOne(n.id)} className="block">
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => unread && markOne(n.id)}
                    className="block w-full text-left"
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
