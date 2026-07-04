'use client';

// Client food-photo diary (call 2026-07-01): snap/upload meal photos so the coach can keep track of
// what you're eating. Upload -> PRIVATE 'food-photos' bucket -> record row -> re-pull signed URLs.
import { useRef, useState, useTransition, type ReactElement } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { PageTitle } from '@/components/ui/section';
import { RecipeImage } from '@/components/coach/recipe-image';
import { createClient } from '@/lib/supabase/client';
import {
  recordFoodPhotoAction,
  listMyFoodPhotos,
  deleteFoodPhotoAction,
  type FoodPhoto,
} from '@/lib/food-photos/actions';

const BUCKET = 'food-photos';
const MAX_BYTES = 10 * 1024 * 1024;
type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function extFor(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/heic' || file.type === 'image/heif') return 'heic';
  return 'jpg';
}
function fmtDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
    new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1),
  );
}

export function FoodPhotosScreen({
  initialPhotos,
  profileId,
}: {
  initialPhotos: FoodPhoto[];
  profileId: string;
}): ReactElement {
  const t = useTranslations('app.nutrition');
  const locale = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<FoodPhoto[]>(initialPhotos);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [slot, setSlot] = useState<Slot>('lunch');
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function pickFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError(t('fpNotImage'));
    if (f.size > MAX_BYTES) return setError(t('fpTooLarge'));
    setPendingFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }
  function reset(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
    setCaption('');
    setSlot('lunch');
    if (fileRef.current) fileRef.current.value = '';
  }

  function save(): void {
    if (!pendingFile) return;
    setError(null);
    start(async () => {
      const supabase = createClient();
      const path = `${profileId}/${crypto.randomUUID()}.${extFor(pendingFile)}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, pendingFile, { cacheControl: '3600', upsert: false, contentType: pendingFile.type });
      if (upErr) return setError(t('fpUploadFailed'));
      const res = await recordFoodPhotoAction({ storagePath: path, caption: caption.trim() || undefined, mealSlot: slot });
      if (!res.ok) {
        await supabase.storage.from(BUCKET).remove([path]);
        return setError(t('fpUploadFailed'));
      }
      reset();
      setPhotos(await listMyFoodPhotos());
    });
  }

  function remove(id: string): void {
    start(async () => {
      const res = await deleteFoodPhotoAction({ id });
      if (res.ok) {
        setError(null);
        setPhotos(await listMyFoodPhotos());
      } else {
        setError(t('fpDeleteFailed'));
      }
    });
  }

  return (
    <div className="px-[22px] pb-7 pt-3">
      <Link href="/nutrition" className="tf-press mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={16} /> {t('mpBack')}
      </Link>
      <PageTitle className="mb-1">{t('fpTitle')}</PageTitle>
      <p className="mb-5 text-[13px] text-faint">{t('fpSubtitle')}</p>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pickFile} className="hidden" />

      {pendingFile == null ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="tf-press mb-5 flex w-full items-center justify-center gap-2 border border-dashed border-line py-6 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
        >
          <Icon name="camera" size={18} /> {t('fpAdd')}
        </button>
      ) : (
        <Card className="mb-5 p-4">
          <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-xl bg-warm">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="mb-3 flex gap-2">
            {SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlot(s)}
                className={`tf-press flex-1 rounded-full py-2 text-[12px] font-semibold ${slot === s ? 'bg-ink text-bg' : 'border border-line text-muted'}`}
              >
                {t(`fpSlot_${s}`)}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={caption}
            maxLength={200}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t('fpCaptionPlaceholder')}
            className="mb-4 w-full border border-line bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-ink"
          />
          <div className="flex gap-2">
            <button type="button" onClick={reset} disabled={busy} className="tf-press flex-1 border border-line py-3 text-[12px] font-semibold uppercase tracking-[1px] text-muted disabled:opacity-50">
              {t('fpCancel')}
            </button>
            <button type="button" onClick={save} disabled={busy} className="tf-press flex-1 border border-ink bg-ink py-3 text-[12px] font-semibold uppercase tracking-[1px] text-bg disabled:opacity-50">
              {busy ? t('fpSaving') : t('fpSave')}
            </button>
          </div>
        </Card>
      )}

      {error && <p className="mb-4 text-[12px] text-red-600">{error}</p>}

      {photos.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <Icon name="camera" size={36} className="mb-3 text-line" />
          <div className="font-display text-[20px]">{t('fpEmpty')}</div>
          <p className="mt-1 max-w-[240px] text-[13px] text-faint">{t('fpEmptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((p) => (
            <div key={p.id}>
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-warm">
                <RecipeImage src={p.url} alt={p.caption ?? ''} icon="camera" sizes="50vw" />
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={busy}
                  aria-label={t('fpDelete')}
                  className="tf-press absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-50"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
              <div className="mt-1.5 px-0.5">
                <div className="text-[12px] font-semibold">
                  {p.mealSlot ? `${t(`fpSlot_${p.mealSlot}`)} · ` : ''}
                  {fmtDate(p.takenOn, locale)}
                </div>
                {p.caption ? <div className="truncate text-[11px] text-faint">{p.caption}</div> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
