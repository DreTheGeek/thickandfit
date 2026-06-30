'use client';

// Subscriber progress-photo screen (PRD-24): capture + gallery + before/after comparison.
// Upload goes browser -> PRIVATE 'progress-photos' bucket (RLS scopes the write to the caller's
// profile-id folder); we then record the row via a server action and re-pull signed URLs.
// Mobile-first, bilingual. Reads always go through short-lived signed URLs (never public).
import { useMemo, useRef, useState, useTransition, type ReactElement } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { PageTitle } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { RecipeImage } from '@/components/coach/recipe-image';
import { PhysiqueAnalysisButton } from '@/components/progress/physique-analysis';
import { createClient } from '@/lib/supabase/client';
import {
  recordPhotoAction,
  listPhotosAction,
  deletePhotoAction,
  type ProgressPhoto,
} from '@/lib/progress-photos/actions';

const BUCKET = 'progress-photos';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, matches the bucket cap.
const KG_TO_LB = 2.20462;

type Tab = 'gallery' | 'compare';

export function ProgressPhotosScreen({
  initialPhotos,
  profileId,
}: {
  initialPhotos: ProgressPhoto[];
  profileId: string;
}): ReactElement {
  const t = useTranslations('app.progress');
  const locale = useLocale();
  const [photos, setPhotos] = useState<ProgressPhoto[]>(initialPhotos);
  const [tab, setTab] = useState<Tab>('gallery');

  async function refresh(): Promise<void> {
    setPhotos(await listPhotosAction());
  }

  return (
    <div className="px-[22px] pb-7 pt-3">
      <div className="mb-1.5">
        <PageTitle>{t('title')}</PageTitle>
      </div>
      <p className="mb-[18px] text-[13px] text-faint">{t('subtitle')}</p>

      <div className="mb-[22px]">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'gallery', label: t('tabGallery') },
            { value: 'compare', label: t('tabCompare') },
          ]}
        />
      </div>

      {tab === 'gallery' ? (
        <Gallery
          photos={photos}
          profileId={profileId}
          locale={locale}
          onChanged={refresh}
        />
      ) : (
        <Compare photos={photos} locale={locale} />
      )}
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

      {error != null && <p className="mb-4 text-[12px] text-red-600">{error}</p>}
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
        {error && <div className="text-[11px] text-red-600">{t('deleteFailed')}</div>}
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
