// Pure label helpers for client facet values, shared by the toolbar chips (and available to
// the rail). Takes the next-intl t fn so callers stay i18n-correct.
import { NONE_KEY, type ClientFilters, type ClientFacets } from '@/lib/coach/clients-types';
import { statusLabelKey } from '@/lib/coach/standing';

type T = (key: string) => string;

export function standingLabel(t: T, k: string): string {
  return t(k === 'healthy' ? 'standingHealthy' : k === 'at_risk' ? 'standingAtRisk' : 'standingChurned');
}
export function healthLabel(t: T, k: string): string {
  if (k === NONE_KEY) return t('healthLegacy');
  if (k === 'paying-current') return t('healthPayingCurrent');
  if (k === 'lapsed') return t('healthLapsed');
  if (k === 'due-soon/late') return t('healthDueSoonLate');
  if (k === 'no-charges-on-record') return t('healthNoCharges');
  return k;
}
export function planLabel(t: T, k: string): string {
  if (k === 'personalCoaching') return t('planPersonalCoaching');
  if (k === 'bootcamp') return t('planBootcamp');
  if (k === 'basic') return t('planBasic');
  return t('statusUnknown');
}
export function langLabel(t: T, k: string): string {
  if (k === 'en') return t('english');
  if (k === 'es') return t('spanish');
  return t('statusUnknown');
}
export function ownerLabel(k: string): string {
  if (k === NONE_KEY) return '-';
  return k.charAt(0).toUpperCase() + k.slice(1);
}

export type ActiveChip = { param: string; value: string; label: string; multi: boolean };

/** Flatten the active filters into removable chips with human labels. */
export function buildActiveChips(t: T, f: ClientFilters, facets: ClientFacets): ActiveChip[] {
  const chips: ActiveChip[] = [];
  const tagMap = new Map(facets.tags.map((x) => [x.slug, x.label]));
  f.standing.forEach((k) => chips.push({ param: 'standing', value: k, label: standingLabel(t, k), multi: true }));
  f.status.forEach((k) => chips.push({ param: 'status', value: k, label: k === NONE_KEY ? t('statusUnknown') : t(statusLabelKey(k)), multi: true }));
  f.health.forEach((k) => chips.push({ param: 'health', value: k, label: healthLabel(t, k), multi: true }));
  f.product.forEach((k) => chips.push({ param: 'product', value: k, label: planLabel(t, k), multi: true }));
  f.tags.forEach((k) => chips.push({ param: 'tags', value: k, label: tagMap.get(k) ?? k, multi: true }));
  f.lang.forEach((k) => chips.push({ param: 'lang', value: k, label: langLabel(t, k), multi: true }));
  f.owner.forEach((k) => chips.push({ param: 'owner', value: k, label: ownerLabel(k), multi: true }));
  f.cohort.forEach((k) => chips.push({ param: 'cohort', value: k, label: k === NONE_KEY ? t('statusUnknown') : k, multi: true }));
  if (f.legacy === true) chips.push({ param: 'legacy', value: '1', label: t('legacy'), multi: false });
  if (f.q) chips.push({ param: 'q', value: f.q, label: `"${f.q}"`, multi: false });
  return chips;
}

/** Serialize the active filters into a saved-segment definition (URL-param shape). */
export function filtersToDefinition(f: ClientFilters): Record<string, unknown> {
  const def: Record<string, unknown> = {};
  (['standing', 'status', 'health', 'product', 'lang', 'owner', 'tags', 'cohort'] as const).forEach((k) => {
    if (f[k].length) def[k] = f[k];
  });
  if (f.legacy === true) def.legacy = '1';
  if (f.q) def.q = f.q;
  if (f.sort !== 'name') def.sort = f.sort;
  if (f.dir !== 'asc') def.dir = f.dir;
  return def;
}
