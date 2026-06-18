// Verification surface for PRD-02. Renders interface strings (driven by ui_locale) and reports
// the two independent locales, so AC-1 (UI strings) and AC-2 (content locale independent) are testable.
import { getTranslations } from 'next-intl/server';
import { getUiLocale, getContentLocale } from '@/lib/i18n/locale';
import { LanguageToggle } from '@/components/i18n/language-toggle';

export const dynamic = 'force-dynamic';

export default async function I18nDemoPage() {
  const t = await getTranslations('common');
  const nav = await getTranslations('nav');
  const uiLocale = await getUiLocale();
  const contentLocale = await getContentLocale();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-12 text-black">
      <h1 className="text-2xl font-bold uppercase tracking-tight">{t('language')}</h1>
      <p data-testid="locales">
        ui={uiLocale} content={contentLocale}
      </p>
      <p data-testid="signin">{t('signIn')}</p>
      <p data-testid="nav-workouts">{nav('workouts')}</p>
      <LanguageToggle uiLocale={uiLocale} contentLocale={contentLocale} />
    </main>
  );
}
