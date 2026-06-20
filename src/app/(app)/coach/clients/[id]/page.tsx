// Premium client detail. RSC: load one contact (company-scoped) -> notFound on miss -> render.
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getClientDetail } from '@/lib/coach/clients';
import { ClientProfile } from '@/components/coach/client-profile';

export const dynamic = 'force-dynamic';

export default async function CoachClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  if (!ctx.companyId) notFound();
  const { id } = await params;
  const detail = await getClientDetail(ctx.companyId, id);
  if (!detail) notFound();
  const locale = await getLocale();
  return <ClientProfile detail={detail} locale={locale} />;
}
