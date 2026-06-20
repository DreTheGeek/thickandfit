// Lead/opportunity detail. RSC: load one opportunity (company-scoped) -> notFound on miss.
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getLeadDetail } from '@/lib/coach/leads';
import { LeadProfile } from '@/components/coach/lead-profile';

export const dynamic = 'force-dynamic';

export default async function CoachLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  if (!ctx.companyId) notFound();
  const { id } = await params;
  const detail = await getLeadDetail(ctx.companyId, id);
  if (!detail) notFound();
  const locale = await getLocale();
  const { from } = await searchParams;
  const fromQs = typeof from === 'string' ? from : '';
  const backHref = fromQs ? `/coach/leads?${fromQs}` : '/coach/leads';
  return <LeadProfile detail={detail} locale={locale} backHref={backHref} />;
}
