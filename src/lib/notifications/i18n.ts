// Tiny locale resolver for notification copy. Notifications are stored as plain text in the DB
// (not message keys), so we render them at creation time in EACH recipient's ui_locale. This
// loads the message catalog directly (independent of the per-request next-intl context, because
// a fan-out delivers to many users with different locales in one server action).
import 'server-only';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

type Catalog = typeof en;
const CATALOGS: Record<'en' | 'es', Catalog> = { en, es: es as Catalog };

export type NotifLocale = 'en' | 'es';

export function asNotifLocale(value: string | null | undefined): NotifLocale {
  return value === 'es' ? 'es' : 'en';
}

/** Pull the `app.notifications.copy.*` subtree for a locale, with EN fallback. */
function copyFor(locale: NotifLocale): Record<string, string> {
  const node = CATALOGS[locale]?.app?.notifications?.copy as Record<string, string> | undefined;
  const fallback = CATALOGS.en.app.notifications.copy as Record<string, string>;
  return node ?? fallback;
}

/**
 * Resolve a notification copy key into a localized string with `{var}` interpolation.
 * Falls back to EN, then to the raw key if missing.
 */
export function notifText(
  locale: NotifLocale,
  key: string,
  vars: Record<string, string> = {},
): string {
  const table = copyFor(locale);
  const enTable = CATALOGS.en.app.notifications.copy as Record<string, string>;
  let template = table[key] ?? enTable[key] ?? key;
  for (const [name, value] of Object.entries(vars)) {
    template = template.replaceAll(`{${name}}`, value);
  }
  return template;
}
