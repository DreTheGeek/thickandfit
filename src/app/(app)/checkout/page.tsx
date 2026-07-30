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
import { normalizeTier, isSelfServe } from '@/lib/billing/tiers';
import {
  currentOffer,
  foundingDaysLeft,
  priceCentsForOffer,
  formatPriceCents,
} from '@/lib/billing/offer';
import { getSupportEmail } from '@/lib/admin/settings';

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
    .select('computed_targets, answers')
    .eq('profile_id', ctx.userId)
    .maybeSingle();
  const row = (onb as { computed_targets: Targets | null; answers: { tier?: string } | null } | null) ?? null;
  const targets = (row?.computed_targets ?? null) as Targets | null;
  // The tier the member chose at onboarding decides the flow: self-serve subscribe vs application.
  const tier = normalizeTier(row?.answers?.tier);
  const selfServe = isSelfServe(tier);
  const supportEmail = selfServe ? '' : await getSupportEmail(ctx.companyId);

  const features = [t('featureWorkouts'), t('featureNutrition'), t('featureCoach'), t('featureCommunity')];

  // The live price. Read the clock ONCE here in the server component rather than inside the render
  // body of a child (the project's purity rule), and show the member the exact number the checkout
  // action will charge: a page that says $19.97 while the action bills $24.97 is a dispute.
  const offer = currentOffer(new Date());
  const selfPrice = formatPriceCents(priceCentsForOffer(offer));
  const daysLeft = foundingDaysLeft(new Date());

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

      {/* Chosen plan + the right action for its tier. */}
      <div className="mt-7">
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">
          {t('planLabel')}
        </div>
        <Card className="p-5">
          <div className="font-display text-[20px]">{t(`tier.${tier}.name`)}</div>
          <div className="mt-0.5 text-[13px] text-muted">
            {selfServe ? `${selfPrice}/mo` : t(`tier.${tier}.price`)}
          </div>
          {selfServe && offer === 'founding' ? (
            <p className="mt-1.5 text-[12px] leading-[1.5] text-accent-ink">
              {t('foundingNote', { days: daysLeft })}
            </p>
          ) : null}

          {selfServe ? (
            <BillingActions mode="none" tier={tier} />
          ) : (
            <div className="mt-4 border-t border-line pt-4">
              <div className="text-[14px] font-semibold">{t('applyTitle')}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-soft">{t('applyBody')}</p>
              <a
                href={supportEmail ? `mailto:${supportEmail}` : '/inbox'}
                className="tf-press mt-3 block w-full bg-accent py-3.5 text-center text-[12px] font-semibold uppercase tracking-[2px] text-accent-ink"
              >
                {t('applyCta')}
              </a>
            </div>
          )}
        </Card>

        {/* High-ticket members can still start on Self-Guided today instead of waiting on the team. */}
        {!selfServe ? (
          <div className="mt-4">
            <div className="mb-1.5 text-[12px] text-muted">{t('orSelfGuided')}</div>
            <Card className="p-5">
              <div className="font-display text-[18px]">{t('tier.self.name')}</div>
              <div className="mt-0.5 text-[13px] text-muted">{selfPrice}/mo</div>
              <BillingActions mode="none" tier="self" />
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
