// IP/country -> default UI locale. LATAM + Spain default to ES, everything else EN.
import { defaultLocale, type Locale } from '@/i18n/request';

const SPANISH_DEFAULT = new Set([
  'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO',
  'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR', 'ES',
]);

export function localeForCountry(country?: string | null): Locale {
  return country && SPANISH_DEFAULT.has(country.toUpperCase()) ? 'es' : defaultLocale;
}
