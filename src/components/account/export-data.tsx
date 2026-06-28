'use client';
// Download my data (GDPR Art. 20 / CCPA). Calls the server action, then builds a Blob and clicks a
// generated <a download> so the browser saves thickandfit-my-data.json locally. No new route surface.
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { exportMyDataAction } from '@/lib/account/actions';

export function ExportData(): ReactElement {
  const t = useTranslations('app.account');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function download(): void {
    setError(null);
    startTransition(async () => {
      const res = await exportMyDataAction();
      if ('error' in res && res.error) {
        setError(t('exportError'));
        return;
      }
      if (!('json' in res) || !res.json) {
        setError(t('exportError'));
        return;
      }
      const blob = new Blob([res.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'thickandfit-my-data.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-soft">{t('exportBody')}</p>
      <button
        type="button"
        onClick={download}
        disabled={pending}
        className="tf-press mt-3 w-full border border-line py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted disabled:opacity-50"
      >
        {pending ? t('exportPending') : t('exportData')}
      </button>
      {error ? <p className="mt-2 text-[12px] text-alert">{error}</p> : null}
    </div>
  );
}
