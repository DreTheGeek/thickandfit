// Money formatting from BIGINT cents. Enforces the _cents convention; never divide ad hoc in JSX.
export function formatCents(
  cents: number | null | undefined,
  currency = 'USD',
  locale = 'en',
  fractionDigits = 0,
): string {
  if (cents == null) return '-';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(cents / 100);
}
