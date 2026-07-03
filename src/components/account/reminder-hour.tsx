'use client';
// Daily reminder hour picker (user-local). The hourly reminders cron filters to members whose
// CURRENT local hour equals this value; there was previously no UI to change it from the default.
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { setReminderHourAction } from '@/lib/account/timezone-actions';

function hourLabel(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${ampm}`;
}

export function ReminderHour({ initial }: { initial: number }): ReactElement {
  const t = useTranslations('app.account');
  const [hour, setHour] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function change(next: number): void {
    const prev = hour;
    setHour(next);
    setError(false);
    startTransition(async () => {
      const res = await setReminderHourAction(next);
      if (!res.ok) {
        setHour(prev);
        setError(true);
      }
    });
  }

  return (
    <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface px-4 py-3.5">
      <div>
        <span className="text-[14px] text-ink">{t('reminderHourLabel')}</span>
        <p className="text-[11px] text-faint">{t('reminderHourHint')}</p>
      </div>
      <select
        value={hour}
        onChange={(e) => change(Number(e.target.value))}
        disabled={pending}
        aria-label={t('reminderHourLabel')}
        className="rounded-lg border border-line bg-bg px-3 py-2 text-[13px] outline-none focus:border-ink"
      >
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h}>
            {hourLabel(h)}
          </option>
        ))}
      </select>
      {error && <span className="ml-2 text-[11px] text-alert-ink">!</span>}
    </div>
  );
}
