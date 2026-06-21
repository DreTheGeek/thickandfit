'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { runGhlSync } from '@/lib/coach/ghl-sync-actions';

export function SyncNowButton({ lastSyncLabel }: { lastSyncLabel: string | null }): ReactElement {
  const t = useTranslations('app.coach');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  // The label is formatted on the server (in the page) and passed in as a string. Formatting a
  // timestamp with a time component here (client) would render in the browser TZ while the server
  // rendered UTC, causing a React #418 hydration mismatch.
  const last = lastSyncLabel;

  function go(): void {
    setMsg('');
    start(async () => {
      const r = await runGhlSync();
      setMsg(r.ok ? t('syncDone', { n: r.opportunities }) : t('syncFailed'));
    });
  }

  return (
    <div className="flex items-center gap-2.5">
      {msg ? (
        <span className="text-[11px] text-muted">{msg}</span>
      ) : (
        last && <span className="text-[11px] text-faint">{t('lastSynced', { when: last })}</span>
      )}
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="tf-press inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink disabled:opacity-50"
      >
        <Icon name="refresh" size={14} className={pending ? 'animate-spin' : ''} />
        {pending ? t('syncRunning') : t('syncNow')}
      </button>
    </div>
  );
}
