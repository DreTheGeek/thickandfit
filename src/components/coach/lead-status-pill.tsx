'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { LEAD_STATUS_VARIANT, leadStatusKey, type LeadStatus } from '@/lib/coach/lead-standing';

export function LeadStatusPill({ status, className = '' }: { status: LeadStatus; className?: string }): ReactElement {
  const t = useTranslations('app.coach');
  return (
    <Badge variant={LEAD_STATUS_VARIANT[status]} className={className}>
      {t(leadStatusKey(status))}
    </Badge>
  );
}
