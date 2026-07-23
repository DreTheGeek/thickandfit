// Evolution timeline, presentation only.
//
// Every number and every row on this surface comes from a row she created. This component invents
// nothing: it renders what the summary hands it and renders nothing when the summary is empty. A
// stat cell with no value is dropped, not zero-filled, and the whole surface disappears when there
// is no start anchor. See src/lib/evolution/types.ts for the honesty rule.
//
// Server component on purpose: there is no interactivity here, so it costs zero client JS.
import type { ReactElement } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import type { EvolutionEntry, EvolutionSummary } from '@/lib/evolution/types';

/** Dots that mark a beginning or a picture get the accent. Everything else stays quiet. */
const ACCENT_KINDS: ReadonlySet<EvolutionEntry['kind']> = new Set(['started', 'photo']);

/**
 * ISO yyyy-mm-dd is already a calendar day in HER timezone, so it must be formatted as a plain
 * date. Parsing it through the runtime's local zone would shift it a day for the LATAM audience.
 */
function formatDay(iso: string, locale: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Signed so a loss reads as a loss. No rounding beyond one decimal, which is what she logged. */
function formatDelta(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(value);
}

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function StatCell({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}): ReactElement {
  return (
    <div className="rounded-xl bg-warm px-3 py-3">
      <div className={`tf-display text-[26px] leading-none ${accent ? 'text-accent' : 'text-ink'}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[1px] text-faint">
        {label}
      </div>
    </div>
  );
}

function Bookend({
  url,
  caption,
  note,
}: {
  url: string;
  caption: string;
  note?: string;
}): ReactElement {
  return (
    <figure className="overflow-hidden rounded-2xl bg-warm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" loading="lazy" className="h-56 w-full object-cover" />
      <figcaption className="px-3 py-2">
        <div className="text-[11px] font-semibold text-ink">{caption}</div>
        {note != null && <div className="mt-0.5 text-[11px] text-faint">{note}</div>}
      </figcaption>
    </figure>
  );
}

/** entry.title is a message key; consistency entries carry their number in detail. next-intl's
 *  generated key union cannot see these dynamic keys, so the cast is contained here. */
function translateTitle(
  t: ReturnType<typeof useTranslations<'app'>>,
  entry: EvolutionEntry,
): string {
  const translate = t as unknown as (key: string, values?: Record<string, string>) => string;
  return entry.kind === 'consistency'
    ? translate(entry.title, { count: entry.detail ?? '' })
    : translate(entry.title);
}

function TimelineRow({
  entry,
  weekLabel,
  title,
  locale,
  gentle,
}: {
  entry: EvolutionEntry;
  weekLabel: string;
  /** Already localized by the parent: entry.title is a message KEY, never display text. */
  title: string;
  locale: string;
  gentle: boolean;
}): ReactElement {
  const deltaText =
    entry.delta != null
      ? `${formatDelta(entry.delta, locale)}${entry.unit != null ? ` ${entry.unit}` : ''}`
      : null;
  const isLoss = entry.delta != null && entry.delta < 0;

  return (
    <li className="flex gap-3 pb-5 last:pb-0">
      <div className="relative w-2 shrink-0">
        <span
          className={`absolute left-0 top-1.5 block h-2 w-2 rounded-full ${
            ACCENT_KINDS.has(entry.kind) ? 'bg-accent' : 'bg-warm'
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[1px] text-faint">
          {weekLabel}
        </div>
        <div className="mt-0.5 text-[13px] font-semibold text-ink">{title}</div>
        {entry.detail != null && entry.kind !== 'consistency' && (
          <div className="mt-0.5 text-[12px] text-muted">{entry.detail}</div>
        )}
        {deltaText != null && (
          <div
            className={`mt-0.5 text-[12px] font-semibold ${
              isLoss && !gentle ? 'text-accent' : 'text-ink'
            }`}
          >
            {deltaText}
          </div>
        )}
        {entry.kind === 'photo' && entry.photoUrl != null && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.photoUrl}
              alt=""
              loading="lazy"
              className="mt-2 h-20 w-16 rounded-lg object-cover"
            />
          </>
        )}
      </div>
    </li>
  );
}

export function EvolutionTimeline({
  data,
  gentle = false,
}: {
  data: EvolutionSummary;
  /** Difficult-relationship-with-food screen: lead with the process tiles (photos, meals) instead
   *  of a weight/waist-change hero, and never celebrate a loss in the success colour. The timeline
   *  keeps every real entry; it just stops presenting shrinking as the win. */
  gentle?: boolean;
}): ReactElement | null {
  const t = useTranslations('app');
  const locale = useLocale();

  // No start anchor means she has no record yet. Render nothing rather than an empty promise.
  if (data.startedOn === null) return null;

  const { first, latest, weeksBetween } = data.bookends;
  const hasPair = first !== null && latest !== null && first.url !== latest.url;
  const lone = hasPair ? null : (first ?? latest);

  // Under gentle framing the weight/waist tiles are suppressed, so the strip only exists if there
  // is a process metric to show.
  const showBodyStats = !gentle;
  const hasStats =
    (showBodyStats && (data.weightDelta != null || data.waistDelta != null)) ||
    data.photoCount > 0 ||
    data.mealsLogged > 0;

  // Ascending in the data, newest first on the wall.
  const rows = [...data.entries].reverse();
  const isBare = rows.length <= 1;

  return (
    <Card className="p-5">
      <div className="tf-eyebrow text-[10px]">{t('evolution.eyebrow')}</div>
      {data.weeksIn != null && (
        <h2 className="tf-display mt-1.5 text-[40px] text-ink">
          {t('evolution.weekN', { n: data.weeksIn })}
        </h2>
      )}

      {/* Only rendered when at least one cell has a real value. An empty strip is dead space. */}
      <div className={`mt-4 grid-cols-2 gap-3 sm:grid-cols-4 ${hasStats ? 'grid' : 'hidden'}`}>
        {showBodyStats && data.weightDelta != null && (
          <StatCell
            value={`${formatDelta(data.weightDelta, locale)}${
              data.weightUnit != null ? ` ${data.weightUnit}` : ''
            }`}
            label={t('evolution.statWeight')}
            accent={data.weightDelta < 0}
          />
        )}
        {showBodyStats && data.waistDelta != null && (
          <StatCell
            value={`${formatDelta(data.waistDelta, locale)}${
              data.lengthUnit != null ? ` ${data.lengthUnit}` : ''
            }`}
            label={t('evolution.statWaist')}
            accent={data.waistDelta < 0}
          />
        )}
        {data.photoCount > 0 && (
          <StatCell
            value={formatCount(data.photoCount, locale)}
            label={t('evolution.statPhotos')}
          />
        )}
        {data.mealsLogged > 0 && (
          <StatCell
            value={formatCount(data.mealsLogged, locale)}
            label={t('evolution.statMeals')}
          />
        )}
      </div>

      {hasPair && first !== null && latest !== null && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Bookend url={first.url} caption={formatDay(first.on, locale)} />
          <Bookend
            url={latest.url}
            caption={formatDay(latest.on, locale)}
            note={weeksBetween != null ? t('evolution.weeksLater', { n: weeksBetween }) : undefined}
          />
        </div>
      )}
      {lone !== null && (
        <div className="mt-5 w-1/2 pr-1.5">
          <Bookend url={lone.url} caption={formatDay(lone.on, locale)} />
        </div>
      )}

      {isBare ? (
        <p className="mt-5 text-[13px] text-muted">{t('evolution.emptyBody')}</p>
      ) : (
        <div className="relative mt-6">
          {/* The thread. One continuous rule from the newest dot to the oldest, so the rows read
              as a single story instead of a stack of unrelated cards. */}
          <span
            aria-hidden="true"
            className="absolute bottom-2 left-[3.5px] top-2 border-l border-divider"
          />
          <ol className="relative">
            {rows.map((entry) => (
              <TimelineRow
                key={entry.id}
                entry={entry}
                weekLabel={t('evolution.weekN', { n: entry.week })}
                title={translateTitle(t, entry)}
                locale={locale}
                gentle={gentle}
              />
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
