// Account settings (Phase 1: language preferences + sign out). Fuller billing /
// cancel flows arrive with Stripe (PRD-05).
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { LanguageToggle } from '@/components/i18n/language-toggle';
import { Icon } from '@/components/ui/icons';
import { PageTitle } from '@/components/ui/section';
import { signOutAction } from '@/lib/auth/actions';

export const dynamic = 'force-dynamic';

export default async function AccountPage(): Promise<ReactElement> {
  const ctx = await requireAuth();
  const t = await getTranslations('app');
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('ui_locale, content_locale')
    .eq('id', ctx.userId)
    .maybeSingle();

  return (
    <div className="px-[22px] pb-7 pt-3">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/you" aria-label={t('common.back')} className="tf-press text-faint">
          <Icon name="arrowLeft" size={20} />
        </Link>
        <PageTitle>{t('you.accountSettings')}</PageTitle>
      </div>

      <LanguageToggle
        uiLocale={profile?.ui_locale ?? 'en'}
        contentLocale={profile?.content_locale ?? 'en'}
      />

      <form action={signOutAction} className="mt-8">
        <button
          type="submit"
          className="tf-press w-full border border-line py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
        >
          {t('common.signOut')}
        </button>
      </form>
    </div>
  );
}
