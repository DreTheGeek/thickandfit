'use client';
// Print / save-as-PDF for the meal-plan document. Opens every collapsed Method <details> first so
// the printed document is complete (matching Stephanie's full PDF handouts), then prints.
import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';

export function PlanPrintButton(): ReactElement {
  const t = useTranslations('app.nutrition');
  function onPrint(): void {
    document.querySelectorAll('details').forEach((d) => {
      d.open = true;
    });
    window.print();
  }
  return (
    <button
      type="button"
      onClick={onPrint}
      className="tf-press inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink print:hidden"
    >
      <Icon name="download" size={14} />
      {t('mpPrint')}
    </button>
  );
}
