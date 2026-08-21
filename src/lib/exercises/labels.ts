/**
 * Turning a database slug into something a person reads, in her language.
 *
 * WHY THIS IS SHARED. The member browser has done this correctly for months, guarding every lookup
 * and degrading to a title-cased slug when the catalog trails the data. The coach library did not:
 * it rendered `{m.key}` straight onto the chip, so Stephanie's own screen said "middle back" and
 * "bodyonly" in lower case, in English, on a bilingual product. Two implementations of one job is
 * how they drift; this is the one, and both import it.
 *
 * The VALUE always stays the English slug because the filters key on it. Only the LABEL is
 * localized.
 *
 * Pure, no directive, no `server-only`: both a client component and a server component import it.
 */

/** slug -> i18n key. 'body only' -> 'bodyOnly', 'e-z curl bar' -> 'eZCurlBar'. */
export function labelKey(slug: string): string {
  return slug
    .split(/[\s-]+/)
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

/**
 * Title-case the raw slug as a last resort.
 *
 * The library carries 17 muscle groups, 13 equipment types and 3 difficulty levels, and the catalog
 * will always trail the data by a row or two, so an unlabelled value must degrade to "Middle Back"
 * rather than to a crash or a blank.
 */
export function humanize(slug: string): string {
  return slug.replace(/[\s-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The catalogs under `app.library` that carry slug labels. */
export type LabelGroup = 'muscles' | 'equipmentTypes' | 'difficulty';

/**
 * A minimal shape for next-intl's translator, so this file needs no next-intl import and stays
 * usable from either side of the server boundary.
 */
export type SlugTranslator = {
  (key: never): string;
  has: (key: never) => boolean;
};

/**
 * The localized label for a slug, or a readable fallback.
 *
 * `t.has()` is load-bearing, not defensive dressing: next-intl's `t()` on a missing key renders the
 * KEY PATH, so an untranslated value prints `app.library.muscles.neck` onto a chip. That is the
 * exact failure this guards, and it is why the fallback is `humanize` rather than the raw slug.
 */
export function slugLabel(
  t: SlugTranslator,
  slug: string | null | undefined,
  group: LabelGroup,
): string {
  if (!slug) return '';
  const key = `${group}.${labelKey(slug)}`;
  return t.has(key as never) ? t(key as never) : humanize(slug);
}
