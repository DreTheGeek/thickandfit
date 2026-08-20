'use client';

// Subscriber progress-photo screen (PRD-24): capture + gallery + before/after comparison.
// Upload goes browser -> PRIVATE 'progress-photos' bucket (RLS scopes the write to the caller's
// profile-id folder); we then record the row via a server action and re-pull signed URLs.
// Mobile-first, bilingual. Reads always go through short-lived signed URLs (never public).
import { useMemo, useRef, useState, useTransition, type ReactElement } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { PortalScreen, PortalHeader, PortalTabs, PortalMeter, PortalDataRow, PortalStatRow } from '@/components/portal/portal-chrome';
import { PortalCard, PortalLabel } from '@/components/portal/today-cards';
import { WeightTrendChart } from '@/components/progress/weight-trend-chart';
import type { StrengthSummary } from '@/lib/progress/strength';
import { RecipeImage } from '@/components/coach/recipe-image';
import { PhysiqueAnalysisButton } from '@/components/progress/physique-analysis';
import { BodyProgress } from '@/components/progress/body-progress';
import { createClient } from '@/lib/supabase/client';
import type { BodyStats, WeekRollup } from '@/lib/body/types';
import {
  recordPhotoAction,
  listPhotosAction,
  deletePhotoAction,
  type ProgressPhoto,
} from '@/lib/progress-photos/actions';

const BUCKET = 'progress-photos';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, matches the bucket cap.
const KG_TO_LB = 2.20462;

/**
 * Five tabs, per the handoff, and `strength` is CONDITIONAL.
 *
 * set_logs holds 25 sets across 4 movements for one member today: the app is pre-launch, and her
 * 256 migrating clients arrive with session-level Lenus history and no set-level loads at all. A
 * Strength tab would render an empty state on day one for every one of them, on the screen whose
 * job is to show progress, and this app fails open everywhere so an empty tab and a broken query
 * look identical. It appears once there is a story to tell, which happens on its own as she trains.
 *
 * `gallery` keeps its VALUE so /you's existing ?tab= link still resolves; the contract labels it
 * Photos, which is what the label says. `compare` stays reachable by URL but is off the tab row:
 * the contract's fifth tab is Consistency, and Compare lives inside the Photos screen there.
 */
export type Tab = 'overview' | 'body' | 'strength' | 'gallery' | 'consistency' | 'compare';

export function ProgressPhotosScreen({
  initialPhotos,
  profileId,
  body,
  goal = null,
  weeksToGo = null,
  strength = null,
  initialTab = 'overview',
}: {
  initialPhotos: ProgressPhoto[];
  profileId: string;
  body: BodyStats;
  /** Start / current / goal and percent, from the SAME helper Today reads. */
  goal?: { startLb: number; currentLb: number; goalLb: number; pct: number } | null;
  /** Weeks to goal at her current pace, or null when the engine has no honest date to give. */
  weeksToGo?: number | null;
  strength?: StrengthSummary | null;
  initialTab?: Tab;
}): ReactElement {
  const t = useTranslations('app.progress');
  const locale = useLocale();
  const [photos, setPhotos] = useState<ProgressPhoto[]>(initialPhotos);
  const [tab, setTab] = useState<Tab>(initialTab);

  async function refresh(): Promise<void> {
    setPhotos(await listPhotosAction());
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: 'overview', label: t('tabOverview') },
    { value: 'body', label: t('tabBody') },
    ...(strength?.hasEnough ? [{ value: 'strength' as Tab, label: t('tabStrength') }] : []),
    { value: 'gallery', label: t('tabGallery') },
    { value: 'consistency', label: t('tabConsistency') },
  ];

  return (
    <PortalScreen>
      <PortalHeader title={t('title')} sub={tab === 'body' ? t('bodySubtitle') : t('subtitle')} />

      <PortalTabs<Tab> value={tab} onChange={setTab} options={tabs} />

      {tab === 'overview' ? (
        <Overview body={body} goal={goal} weeksToGo={weeksToGo} />
      ) : tab === 'body' ? (
        <BodyProgress body={body} />
      ) : tab === 'strength' ? (
        <Strength strength={strength} />
      ) : tab === 'gallery' ? (
        <Gallery photos={photos} profileId={profileId} locale={locale} onChanged={refresh} />
      ) : tab === 'consistency' ? (
        <Consistency rollups={body.rollups} locale={locale} />
      ) : (
        <Compare photos={photos} locale={locale} />
      )}
    </PortalScreen>
  );
}

/**
 * The handoff's Overview: the weight trend, the summary rows, and the same percentage Today shows.
 * Both read weightGoalFromKg, so the two screens cannot drift on the one number a member is most
 * likely to check twice.
 */
function Overview({
  body,
  goal,
  weeksToGo,
}: {
  body: BodyStats;
  goal: { startLb: number; currentLb: number; goalLb: number; pct: number } | null;
  weeksToGo: number | null;
}): ReactElement {
  const t = useTranslations('app.progress');
  const series = body.weightSeries;
  const totalLb =
    series.length > 1
      ? Math.round((series[series.length - 1].lb - series[0].lb) * 10) / 10
      : null;

  return (
    <div className="grid gap-2.5">
      <PortalCard className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <PortalLabel>{t('weightTrend')}</PortalLabel>
            <div className="mt-0.5 text-[11px] text-faint">{t('last90Days')}</div>
          </div>
          {totalLb != null && (
            <div className="text-right">
              <strong className="block text-[15px] tabular-nums">
                {totalLb > 0 ? `+${totalLb}` : totalLb} lb
              </strong>
              <span className="text-[8px] uppercase tracking-[0.6px] text-faint">{t('totalChange')}</span>
            </div>
          )}
        </div>
        <div className="mt-3">
          {/* The goal line is drawn where she has one. The chart already knows how to include it in
              its own scale, so passing it also stops the trend filling the frame and hiding how far
              there is left to go. */}
          <WeightTrendChart series={series} goalLb={goal?.goalLb ?? null} goalLabel={t('goalWeight')} />
        </div>
      </PortalCard>

      {goal && (
        <PortalCard className="p-3.5">
          <PortalLabel>{t('progressSummary')}</PortalLabel>
          <div className="mt-1.5">
            <PortalDataRow label={t('startWeight')} value={`${goal.startLb} lb`} />
            <PortalDataRow label={t('currentWeight')} value={`${goal.currentLb} lb`} />
            <PortalDataRow label={t('goalWeight')} value={`${goal.goalLb} lb`} />
            {weeksToGo != null && (
              <PortalDataRow label={t('timeToGoal')} value={t('weeksN', { n: weeksToGo })} tone="hit" />
            )}
          </div>
          <PortalMeter className="mt-3" pct={goal.pct} />
          <p className="mt-2.5 text-center text-[13px] text-soft">{t('pctToGoal', { n: goal.pct })}</p>
        </PortalCard>
      )}
    </div>
  );
}

/**
 * Consistency: the week-by-week rollup getBodyStats already computes and nothing rendered.
 *
 * The contract's fifth Progress tab. It is the one tab on this screen that is about SHOWING UP
 * rather than about results, which is why it is worth its own place: a member whose weight is flat
 * for a fortnight can still see four trained weeks behind her, and that is usually the true answer
 * to "is this working".
 */
function Consistency({ rollups, locale }: { rollups: WeekRollup[]; locale: string }): ReactElement {
  const t = useTranslations('app.progress');
  if (rollups.length === 0) {
    return <p className="py-12 text-center text-[13px] text-faint">{t('consistencyEmpty')}</p>;
  }
  const fmt = (iso: string): string => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
      new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1),
    );
  };
  // Newest first: the week she is in is the one she came to check.
  const weeks = [...rollups].reverse();
  return (
    <div className="grid gap-2.5">
      {weeks.map((w) => (
        <PortalCard key={w.startOn} className="p-3.5">
          <div className="flex items-center justify-between gap-3">
            <PortalLabel>{`${fmt(w.startOn)} - ${fmt(w.endOn)}`}</PortalLabel>
            {w.weightDeltaLb != null && w.weightDeltaLb !== 0 && (
              <span className="text-[12px] tabular-nums text-muted">
                {w.weightDeltaLb > 0 ? `+${w.weightDeltaLb}` : w.weightDeltaLb} lb
              </span>
            )}
          </div>
          <PortalStatRow
            className="mt-2"
            order="label-first"
            divider
            stats={[
              { key: 'w', label: t('statWorkouts'), value: String(w.workouts) },
              { key: 'd', label: t('statDaysLogged'), value: String(w.daysLogged) },
            ]}
          />
        </PortalCard>
      ))}
    </div>
  );
}

/** Her strongest set per movement. Only rendered when there is enough history to mean something. */
function Strength({ strength }: { strength: StrengthSummary | null }): ReactElement {
  const t = useTranslations('app.progress');
  if (!strength || strength.movements.length === 0) {
    return <p className="py-12 text-center text-[13px] text-faint">{t('strengthEmpty')}</p>;
  }
  return (
    <div className="grid gap-2.5">
      {strength.movements.map((m) => (
        <PortalCard key={m.exerciseId} className="flex items-center justify-between gap-3 p-3.5">
          <div className="min-w-0">
            <strong className="block truncate text-[13px]">{m.name}</strong>
            <small className="block text-faint">
              {m.bestWeight > 0
                ? t('bestSet', { weight: m.bestWeight, reps: m.bestReps })
                : t('bestReps', { reps: m.bestReps })}
            </small>
          </div>
          {m.gainLb != null && m.gainLb !== 0 && (
            <strong className={`flex-none text-[13px] tabular-nums ${m.gainLb > 0 ? 'text-accent' : ''}`}>
              {m.gainLb > 0 ? `+${m.gainLb}` : m.gainLb} lb
            </strong>
          )}
        </PortalCard>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Gallery: uploader + grid.
// ---------------------------------------------------------------------------------------------
function Gallery({
  photos,
  profileId,
  locale,
  onChanged,
}: {
  photos: ProgressPhoto[];
  profileId: string;
  locale: string;
  onChanged: () => Promise<void>;
}): ReactElement {
  const t = useTranslations('app.progress');
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [takenOn, setTakenOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [pose, setPose] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, startBusy] = useTransition();

  function pickFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    setOk(false);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('notImage'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t('tooLarge'));
      return;
    }
    setPendingFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function resetForm(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
    setPose('');
    setWeight('');
    setTakenOn(new Date().toISOString().slice(0, 10));
    if (fileRef.current) fileRef.current.value = '';
  }

  function save(): void {
    if (!pendingFile) return;
    setError(null);
    startBusy(async () => {
      try {
        const supabase = createClient();
        const ext = extFor(pendingFile);
        const uuid = crypto.randomUUID();
        const path = `${profileId}/${uuid}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, pendingFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: pendingFile.type,
          });
        if (upErr) {
          setError(t('uploadFailed'));
          return;
        }

        const weightNum = weight.trim() === '' ? undefined : Number(weight);
        const res = await recordPhotoAction({
          storagePath: path,
          takenOn,
          pose: pose.trim() || undefined,
          weight: Number.isFinite(weightNum) && weightNum && weightNum > 0 ? weightNum : undefined,
          unit: 'lb',
        });
        if (!res.ok) {
          // The bytes uploaded but the row failed: clean up the orphan object best-effort.
          await supabase.storage.from(BUCKET).remove([path]);
          setError(t('uploadFailed'));
          return;
        }

        setOk(true);
        resetForm();
        await onChanged();
      } catch {
        setError(t('uploadFailed'));
      }
    });
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={pickFile}
        className="hidden"
      />

      {pendingFile == null ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="tf-press mb-5 flex w-full items-center justify-center gap-2 border border-dashed border-line py-6 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
        >
          <Icon name="camera" size={18} />
          {t('addPhoto')}
        </button>
      ) : (
        <Card className="mb-5 p-4">
          <div className="relative mb-4 aspect-[3/4] w-full overflow-hidden rounded-xl bg-warm">
            {previewUrl != null && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>

          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[1px] text-muted">
            {t('dateLabel')}
          </label>
          <input
            type="date"
            value={takenOn}
            onChange={(e) => setTakenOn(e.target.value)}
            className="mb-3 w-full border border-line bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-ink"
          />

          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[1px] text-muted">
            {t('poseLabel')}
          </label>
          <input
            type="text"
            value={pose}
            maxLength={60}
            onChange={(e) => setPose(e.target.value)}
            placeholder={t('posePlaceholder')}
            className="mb-3 w-full border border-line bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-ink"
          />

          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[1px] text-muted">
            {t('weightLabel')}
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={`${t('weightPlaceholder')} (lb)`}
            className="mb-4 w-full border border-line bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-ink"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="tf-press flex-1 border border-line py-3 text-[12px] font-semibold uppercase tracking-[1px] text-muted disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="tf-press flex-1 border border-ink bg-ink py-3 text-[12px] font-semibold uppercase tracking-[1px] text-bg disabled:opacity-50"
            >
              {busy ? t('uploading') : t('save')}
            </button>
          </div>
        </Card>
      )}

      {error != null && <p className="mb-4 text-[12px] text-alert-ink">{error}</p>}
      {ok && <p className="mb-4 text-[12px] text-accent">{t('saved')}</p>}

      {photos.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <Icon name="camera" size={36} className="mb-3 text-line" />
          <div className="font-display text-[20px]">{t('empty')}</div>
          <p className="mt-1 max-w-[240px] text-[13px] text-faint">{t('emptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((p) => (
            <PhotoTile key={p.id} photo={p} locale={locale} onDeleted={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoTile({
  photo,
  locale,
  onDeleted,
}: {
  photo: ProgressPhoto;
  locale: string;
  onDeleted: () => Promise<void>;
}): ReactElement {
  const t = useTranslations('app.progress');
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState(false);

  function remove(): void {
    if (!confirm(t('deleteConfirm'))) return;
    setError(false);
    startBusy(async () => {
      const res = await deletePhotoAction({ id: photo.id });
      if (!res.ok) {
        setError(true);
        return;
      }
      await onDeleted();
    });
  }

  return (
    <div>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-warm">
        <RecipeImage src={photo.url} alt={photo.pose ?? ''} icon="camera" sizes="50vw" />
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label={t('delete')}
          className="tf-press absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-50"
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="mt-1.5 px-0.5">
        <div className="text-[12px] font-semibold">{formatDate(photo.takenOn, locale)}</div>
        <div className="text-[11px] text-faint">
          {photo.pose ? `${photo.pose} - ` : ''}
          {photo.weightKg != null ? `${lb(photo.weightKg)} lb` : t('noWeight')}
        </div>
        {error && <div className="text-[11px] text-alert-ink">{t('deleteFailed')}</div>}
        <PhysiqueAnalysisButton imageUrl={photo.url} photoId={photo.id} weightKg={photo.weightKg} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Compare: two pickers (default first-vs-latest) side by side.
// ---------------------------------------------------------------------------------------------
function Compare({ photos, locale }: { photos: ProgressPhoto[]; locale: string }): ReactElement {
  const t = useTranslations('app.progress');
  // Photos arrive newest-first. "First" = oldest (last in array), "latest" = newest (first).
  const oldest = photos.length > 0 ? photos[photos.length - 1] : null;
  const newest = photos.length > 0 ? photos[0] : null;

  const [leftId, setLeftId] = useState<string | null>(oldest?.id ?? null);
  const [rightId, setRightId] = useState<string | null>(newest?.id ?? null);

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const left = leftId ? byId.get(leftId) ?? null : null;
  const right = rightId ? byId.get(rightId) ?? null : null;

  if (photos.length < 2) {
    return (
      <div className="flex flex-col items-center py-14 text-center">
        <Icon name="grid" size={36} className="mb-3 text-line" />
        <p className="max-w-[240px] text-[13px] text-faint">{t('compareNeedTwo')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-[20px]">{t('compareTitle')}</span>
      </div>
      <p className="mb-4 text-[13px] text-faint">{t('compareHint')}</p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <ComparePane label={t('before')} photo={left} locale={locale} />
        <ComparePane label={t('after')} photo={right} locale={locale} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <PhotoPicker
          label={t('selectLeft')}
          photos={photos}
          value={leftId}
          onChange={setLeftId}
          locale={locale}
        />
        <PhotoPicker
          label={t('selectRight')}
          photos={photos}
          value={rightId}
          onChange={setRightId}
          locale={locale}
        />
      </div>
    </div>
  );
}

function ComparePane({
  label,
  photo,
  locale,
}: {
  label: string;
  photo: ProgressPhoto | null;
  locale: string;
}): ReactElement {
  const t = useTranslations('app.progress');
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[1px] text-accent">
        {label}
      </div>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-warm">
        <RecipeImage src={photo?.url ?? null} alt={photo?.pose ?? ''} icon="camera" sizes="50vw" />
      </div>
      <div className="mt-1.5">
        <div className="text-[12px] font-semibold">
          {photo ? formatDate(photo.takenOn, locale) : '-'}
        </div>
        <div className="text-[11px] text-faint">
          {photo?.weightKg != null ? `${lb(photo.weightKg)} lb` : t('noWeight')}
        </div>
      </div>
    </div>
  );
}

function PhotoPicker({
  label,
  photos,
  value,
  onChange,
  locale,
}: {
  label: string;
  photos: ProgressPhoto[];
  value: string | null;
  onChange: (id: string) => void;
  locale: string;
}): ReactElement {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[1px] text-muted">
        {label}
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-line bg-transparent px-2 py-2.5 text-[13px] outline-none focus:border-ink"
      >
        {photos.map((p) => (
          <option key={p.id} value={p.id}>
            {formatDate(p.takenOn, locale)}
            {p.pose ? ` - ${p.pose}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
function extFor(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/heic' || file.type === 'image/heif') return 'heic';
  return 'jpg';
}

function lb(kg: number): number {
  return Math.round(kg * KG_TO_LB * 10) / 10;
}

function formatDate(iso: string, locale: string): string {
  // iso is yyyy-mm-dd. Parse as local to avoid a TZ off-by-one.
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
