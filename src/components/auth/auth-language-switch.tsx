'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition, type ReactElement } from 'react';
import { setUiLocaleAction } from '@/lib/i18n/actions';

/**
 * Change the language from the auth screens, signed out.
 *
 * THE TRAP THIS OPENS. ui_locale is a cookie, and the only places that could change it were the
 * Settings screen and the onboarding wizard: both behind the login form. So a visitor whose cookie
 * said the wrong language met a sign-in page she could not read, and the control to fix it was on
 * the other side of that page. It is the one screen in the product where a wrong language is not an
 * annoyance but a locked door.
 *
 * It happened for real. Before 2026-07-31 the cookie was written for a YEAR from the IP country
 * alone, and every browser that visited in that window is still carrying it.
 *
 * Deliberately plain: two words and a separator, under the card, at the size of fine print. It has
 * to be findable by somebody who cannot read the page it sits on, which argues for the word
 * "English" being visible in English rather than hidden behind an icon or a flag. Flags are wrong
 * for this anyway, since neither language belongs to one country.
 */
export function AuthLanguageSwitch(): ReactElement {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const pick = (next: 'en' | 'es'): void => {
    if (next === locale || pending) return;
    start(async () => {
      await setUiLocaleAction(next);
      // The page is server-rendered from the cookie the action just wrote, so it has to re-render
      // for the change to be visible at all.
      router.refresh();
    });
  };

  return (
    <div className="mt-6 text-center text-[12px] text-muted">
      {(['en', 'es'] as const).map((l, i) => (
        <span key={l}>
          {i > 0 && <span className="px-2 text-line">·</span>}
          <button
            type="button"
            onClick={() => pick(l)}
            disabled={pending}
            aria-current={l === locale}
            className={l === locale ? 'font-semibold text-ink' : 'tf-press underline hover:text-ink'}
          >
            {l === 'en' ? 'English' : 'Español'}
          </button>
        </span>
      ))}
    </div>
  );
}
