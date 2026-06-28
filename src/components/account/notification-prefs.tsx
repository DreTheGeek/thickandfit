'use client';
// Notification preferences matrix: one row per category, a push + email toggle each. Optimistic UI,
// upserts via the server action. Locked pairs (billing + every email channel) render as on + disabled
// with a "always on" note (transactional/legal notices can never be silenced).
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { setNotificationPref } from '@/lib/account/notification-preferences';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  isLockedOn,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPrefMap,
} from '@/lib/account/notification-preferences-shared';

export function NotificationPrefs({ initial }: { initial: NotificationPrefMap }): ReactElement {
  const t = useTranslations('app.account');
  const [prefs, setPrefs] = useState<NotificationPrefMap>(initial);
  const [pending, startTransition] = useTransition();

  function toggle(category: NotificationCategory, channel: NotificationChannel): void {
    if (isLockedOn(category, channel)) return;
    const next = !prefs[category][channel];
    // Optimistic flip; revert on failure.
    setPrefs((p) => ({ ...p, [category]: { ...p[category], [channel]: next } }));
    startTransition(async () => {
      const res = await setNotificationPref({ category, channel, enabled: next });
      if (res.error) {
        setPrefs((p) => ({ ...p, [category]: { ...p[category], [channel]: !next } }));
      }
    });
  }

  return (
    <div className="mt-3" data-pending={pending}>
      {/* Channel column headers */}
      <div className="flex items-center justify-end gap-5 px-1 pb-2">
        {NOTIFICATION_CHANNELS.map((channel) => (
          <span
            key={channel}
            className="w-12 text-right text-[10px] font-semibold uppercase tracking-[1.5px] text-faint"
          >
            {t(`channel.${channel}`)}
          </span>
        ))}
      </div>

      <div className="space-y-px overflow-hidden rounded-2xl bg-surface">
        {NOTIFICATION_CATEGORIES.map((category) => (
          <div key={category} className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[14px] text-ink">{t(`category.${category}`)}</span>
            <div className="flex items-center gap-5">
              {NOTIFICATION_CHANNELS.map((channel) => {
                const locked = isLockedOn(category, channel);
                const on = prefs[category][channel];
                return (
                  <div key={channel} className="flex w-12 justify-end">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${t(`category.${category}`)} ${t(`channel.${channel}`)}`}
                      disabled={locked}
                      onClick={() => toggle(category, channel)}
                      className={[
                        'tf-press relative h-6 w-11 rounded-full transition-colors',
                        on ? 'bg-accent' : 'bg-line',
                        locked ? 'opacity-60' : '',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                          on ? 'translate-x-[22px]' : 'translate-x-0.5',
                        ].join(' ')}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-faint">{t('notifLockedNote')}</p>
    </div>
  );
}
