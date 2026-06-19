// Coach settings: language preferences, system status link, sign out. Fuller team/billing
// settings arrive with the relevant phases.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { LanguageToggle } from '@/components/i18n/language-toggle';
import { PageTitle, SectionTitle } from '@/components/ui/section';
import { Icon } from '@/components/ui/icons';
import { signOutAction } from '@/lib/auth/actions';

export const dynamic = 'force-dynamic';

export default async function CoachSettingsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const c = await getTranslations('app.common');
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('ui_locale, content_locale')
    .eq('id', ctx.userId)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
      <PageTitle className="mb-6">{t('settingsTitle')}</PageTitle>

      <div className="rounded-2xl bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <SectionTitle className="mb-4">{c('language')}</SectionTitle>
        <LanguageToggle
          uiLocale={profile?.ui_locale ?? 'en'}
          contentLocale={profile?.content_locale ?? 'en'}
        />
      </div>

      <Link
        href="/coach/health"
        className="tf-press mt-4 flex items-center justify-between rounded-2xl bg-surface px-6 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      >
        <span className="flex items-center gap-3 text-[14px] font-medium">
          <Icon name="pulse" size={18} /> {t('appHealth')}
        </span>
        <Icon name="chevronRight" size={16} className="text-line" />
      </Link>

      <form action={signOutAction} className="mt-6">
        <button
          type="submit"
          className="tf-press w-full rounded-full border border-line py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
        >
          {c('signOut')}
        </button>
      </form>
    </div>
  );
}
