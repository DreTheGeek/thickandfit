// Paywall + checkout. Stripe billing + pricing land in PRD-05/06 (gated). Stub for now.
import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/app/coming-soon';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage(): Promise<ReactElement> {
  const locale = await getLocale();
  return <ComingSoon title={locale === 'es' ? 'Pago' : 'Checkout'} />;
}
