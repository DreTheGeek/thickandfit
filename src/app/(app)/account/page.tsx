// Account settings hub: language, security (change email / password), notification preferences,
// billing link, data export, sign out, and the delete danger zone.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { LanguageToggle } from '@/components/i18n/language-toggle';
import { Icon } from '@/components/ui/icons';
import { PageTitle } from '@/components/ui/section';
import { signOutAction } from '@/lib/auth/actions';
import { DeleteAccount } from '@/components/account/delete-account';
import { ChangeEmail } from '@/components/account/change-email';
import { ChangePassword } from '@/components/account/change-password';
import { NotificationPrefs } from '@/components/account/notification-prefs';
import { ReminderHour } from '@/components/account/reminder-hour';
import { ExportData } from '@/components/account/export-data';
import { readMyNotificationPrefs } from '@/lib/account/notification-preferences';
import { currentOffer, priceCentsForOffer, formatPriceCents } from '@/lib/billing/offer';

export const dynamic = 'force-dynamic';

function SectionLabel({ children }: { children: string }): ReactElement {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[2px] text-faint">{children}</p>
  );
}

export default async function AccountPage(): Promise<ReactElement> {
  const ctx = await requireAuth();
  const t = await getTranslations('app');
  const supabase = await createClient();
  const [{ data: profile }, { data: onb }, { data: userData }, notifPrefs] = await Promise.all([
    supabase
      .from('profiles')
      .select('ui_locale, content_locale, reminder_hour')
      .eq('id', ctx.userId)
      .maybeSingle(),
    supabase.from('onboarding_responses').select('answers').eq('profile_id', ctx.userId).maybeSingle(),
    supabase.auth.getUser(),
    readMyNotificationPrefs(),
  ]);
  const currentEmail = userData.user?.email ?? '';

  // Membership card from the chosen coaching tier (self / team / steph). Reuses the onboarding tier
  // copy; reflects the selection until live billing supplies the real subscription.
  const tier = ((onb?.answers ?? null) as { tier?: string } | null)?.tier ?? null;
  const tierKeys: Record<string, { name: string; price: string }> = {
    self: { name: 'onboarding.tierSelfName', price: 'onboarding.tierSelfPrice' },
    team: { name: 'onboarding.tierTeamName', price: 'onboarding.tierTeamPrice' },
    steph: { name: 'onboarding.tierStephName', price: 'onboarding.tierStephPrice' },
  };
  const tk = tier ? tierKeys[tier] : null;
  // tierSelfPrice carries a {price} placeholder so this card cannot drift from what checkout bills.
  // Clock read once, here, not in a render body. team/steph carry no placeholder and ignore the value.
  const selfPrice = formatPriceCents(priceCentsForOffer(currentOffer(new Date())));

  return (
    <div className="px-[22px] pb-7 pt-3">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/you" aria-label={t('common.back')} className="tf-press text-faint">
          <Icon name="arrowLeft" size={20} />
        </Link>
        <PageTitle>{t('you.accountSettings')}</PageTitle>
      </div>

      {/* Membership card (tier + price).
          Always dark, for the same reason as the goal card on /you: everything inside is literal
          text-white, authored against `<Card dark>` when that always meant a dark card. Inside
          `.tf-portal` that pair resolves to a WHITE card, so her tier and price were white on white. */}
      {tk ? (
        <div className="mb-6 rounded-2xl bg-[#19191c] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[2px] text-white/55">
            {t('account.membership')}
          </div>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="tf-display text-[24px] leading-none text-white">{t(tk.name)}</div>
              <div className="mt-1 text-[13px] text-white/70">{t(tk.price, { price: selfPrice })}</div>
            </div>
            <Link
              href="/account/billing"
              className="tf-press flex-none rounded-full border border-white/35 px-4 py-2 text-[12px] font-semibold uppercase tracking-[1px] text-white"
            >
              {t('account.manage')}
            </Link>
          </div>
        </div>
      ) : null}

      <LanguageToggle
        uiLocale={profile?.ui_locale ?? 'en'}
        contentLocale={profile?.content_locale ?? 'en'}
      />

      {/* Security: change email + password */}
      <div className="mt-8 border-t border-divider pt-6">
        <SectionLabel>{t('account.security')}</SectionLabel>
        <p className="text-[12px] font-semibold uppercase tracking-[2px] text-muted">
          {t('account.changeEmail')}
        </p>
        <ChangeEmail currentEmail={currentEmail} />
        <p className="mt-6 text-[12px] font-semibold uppercase tracking-[2px] text-muted">
          {t('account.changePassword')}
        </p>
        <ChangePassword />
      </div>

      {/* Notification preferences */}
      <div className="mt-8 border-t border-divider pt-6">
        <SectionLabel>{t('account.notifications')}</SectionLabel>
        <NotificationPrefs initial={notifPrefs} />
        <ReminderHour initial={(profile as { reminder_hour?: number | null } | null)?.reminder_hour ?? 19} />
      </div>

      {/* Billing */}
      <Link
        href="/account/billing"
        className="tf-press mt-8 flex items-center justify-between border border-line px-4 py-3.5"
      >
        <span className="text-[12px] font-semibold uppercase tracking-[2px] text-muted">
          {t('billing.title')}
        </span>
        <Icon name="chevronRight" size={18} className="text-faint" />
      </Link>

      {/* Data export */}
      <div className="mt-8 border-t border-divider pt-6">
        <SectionLabel>{t('account.yourData')}</SectionLabel>
        <ExportData />
      </div>

      <form action={signOutAction} className="mt-8">
        <button
          type="submit"
          className="tf-press w-full border border-line py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
        >
          {t('common.signOut')}
        </button>
      </form>

      <div className="mt-10 border-t border-divider pt-6">
        <SectionLabel>{t('account.dangerZone')}</SectionLabel>
        <DeleteAccount />
      </div>
    </div>
  );
}
