// Money formatting from BIGINT cents. Enforces the _cents convention; never divide ad hoc in JSX.
// Deterministic on purpose: Intl.NumberFormat currency output varies between the server's ICU
// (Vercel Node) and the browser's ICU, which caused React #418 hydration mismatches when money is
// rendered in client components. Manual grouping guarantees server === client.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CAD: '$',
  AUD: '$',
  MXN: '$',
  EUR: '€',
  GBP: '£',
};

export function formatCents(
  cents: number | null | undefined,
  currency = 'USD',
  _locale = 'en',
  fractionDigits = 0,
): string {
  if (cents == null) return '-';
  const negative = cents < 0;
  const value = Math.abs(cents) / 100;
  const fixed = value.toFixed(fractionDigits);
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = decPart ? `${grouped}.${decPart}` : grouped;
  const prefix = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${negative ? '-' : ''}${prefix}${body}`;
}
