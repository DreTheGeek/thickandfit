// Paywall entry: the pre-pay surface unentitled members land on (requireEntitled sends them here).
// Shows their personalized plan preview + what a subscription unlocks + the real subscribe control
// (SubscribeButton captures consent + the auto-renewal disclosure before redirecting to Stripe).
// Already-entitled users are bounced to the app.
import type { ReactElement } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { isEntitled } from '@/lib/billing/entitlement';
import { createServiceClient } from '@/lib/supabase/service';
import { PageTitle } from '@/components/ui/section';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { BillingActions } from '@/components/billing/billing-actions';

export const dynamic = 'force-dynamic';

type Targets = { calories: number; macros: { protein_g: number; carbs_g: number; fat_g: number } };

export default async function CheckoutPage(): Promise<ReactElement> {
  const ctx = await requireAuth();
  // Already paying or comped? No paywall for them.
  if (await isEntitled(ctx.userId)) redirect('/dashboard');

  const t = await getTranslations('app.checkout');

  const svc = createServiceClient();
  const { data: onb } = await svc
    .from('onboarding_responses')
    .select('computed_targets')
    .eq('profile_id', ctx.userId)
    .maybeSingle();
  const targets = ((onb as { computed_targets: Targets | null } | null)?.computed_targets ?? null) as Targets | null;

  const features = [t('featureWorkouts'), t('featureNutrition'), t('featureCoach'), t('featureCommunity')];

  return (
    <div className="mx-auto w-full max-w-md px-[22px] pb-10 pt-6">
      <PageTitle>{t('title')}</PageTitle>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">{t('subtitle')}</p>

      {targets ? (
        <Card className="mt-5 p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">
            {t('targetsLabel')}
          </div>
          <div className="mt-1 font-display text-[26px]">{targets.calories} kcal</div>
          <div className="text-[13px] text-muted">
            P{targets.macros.protein_g} · C{targets.macros.carbs_g} · F{targets.macros.fat_g} g
          </div>
        </Card>
      ) : null}

      <div className="mt-6">
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">
          {t('includedLabel')}
        </div>
        <ul className="flex flex-col gap-2.5">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14px]">
              <Icon name="check" size={18} className="mt-0.5 shrink-0 text-accent" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-7">
        <BillingActions mode="none" />
      </div>
    </div>
  );
}
