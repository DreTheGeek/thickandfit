'use client';

// Trigger the AI meal-plan generator for one client (call 2026-07-02: "make these on the fly based on
// client need"). POSTs to /api/coach-ai/plan (coach-gated + rate-limited), then opens the new plan in
// the builder-backed detail view. Reads the client's intake + Stephanie's method server-side.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';

type GenStatus = { ok?: boolean; status?: string; planId?: string };

export function GeneratePlanButton({
  clientProfileId,
  contactId,
  locale,
}: {
  clientProfileId: string;
  contactId: string | null;
  locale: 'en' | 'es';
}): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function generate(): void {
    setErr(null);
    start(async () => {
      let j: GenStatus = {};
      try {
        const res = await fetch('/api/coach-ai/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientProfileId, contactId, locale }),
        });
        j = (await res.json().catch(() => ({}))) as GenStatus;
      } catch {
        setErr(t('genFailed'));
        return;
      }
      if (j.ok && j.planId) {
        router.push(`/coach/tool/meal-plans/${j.planId}`);
        router.refresh();
        return;
      }
      setErr(
        j.status === 'notConfigured' ? t('genNoKey') : j.status === 'noData' ? t('genNoData') : t('genFailed'),
      );
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={generate}
        disabled={pending}
        className="tf-press inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
      >
        <Icon name="sparkles" size={15} />
        {pending ? t('genGenerating') : t('genWithAI')}
      </button>
      {err && <p className="mt-2 text-center text-[12px] text-red-600">{err}</p>}
    </div>
  );
}
