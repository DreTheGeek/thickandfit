'use client';
// Two independent selectors: interface language and content language (Fitia pattern).
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setUiLocaleAction, setContentLocaleAction } from '@/lib/i18n/actions';

export function LanguageToggle({
  uiLocale,
  contentLocale,
}: {
  uiLocale: string;
  contentLocale: string;
}) {
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const selectClass = 'rounded-none border border-black bg-white px-3 py-2 text-sm';

  return (
    <div className="flex flex-wrap gap-4" data-pending={pending}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t('uiLanguage')}</span>
        <select
          className={selectClass}
          defaultValue={uiLocale}
          onChange={(e) =>
            startTransition(async () => {
              await setUiLocaleAction(e.target.value);
              router.refresh();
            })
          }
        >
          <option value="en">{t('english')}</option>
          <option value="es">{t('spanish')}</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t('contentLanguage')}</span>
        <select
          className={selectClass}
          defaultValue={contentLocale}
          onChange={(e) =>
            startTransition(async () => {
              await setContentLocaleAction(e.target.value);
              router.refresh();
            })
          }
        >
          <option value="en">{t('english')}</option>
          <option value="es">{t('spanish')}</option>
        </select>
      </label>
    </div>
  );
}
