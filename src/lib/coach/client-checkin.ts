// Coach read of a client's latest check-in submission + their progress photos (Lenus parity). Parses
// the generic form_responses answers (keyed by field id) against the form's field labels/types, and
// signs the private progress-photo object paths with the service client (same pattern as food photos).
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { getForm } from '@/lib/forms/engine';

const PHOTO_BUCKET = 'progress-photos';
const SIGNED_TTL_SECONDS = 60 * 60;
const KG_TO_LB = 2.20462;

/**
 * Who the check-in belongs to.
 *
 * BOTH keys, always. `profile_id` is set only once a member claims an app account; every row
 * migrated from Lenus carries `contact_id` and a null profile. Querying one key showed half the
 * history, and after the August sweep that meant 851 of 853 check-ins and 2,286 of 2,289 progress
 * photos were invisible to the coach: imported, indexed, and unreachable.
 */
export type CheckinOwner = { profileId?: string | null; contactId?: string | null };

/** PostgREST `or` filter over whichever keys we actually have. Null when we have neither. */
function ownerFilter(owner: CheckinOwner): string | null {
  const parts: string[] = [];
  if (owner.profileId) parts.push(`profile_id.eq.${owner.profileId}`);
  if (owner.contactId) parts.push(`contact_id.eq.${owner.contactId}`);
  return parts.length ? parts.join(',') : null;
}

export type CheckinField = { label: string; type: string; value: string };
export type CheckinPhoto = { id: string; url: string | null; pose: string | null; takenOn: string; weightLb: number | null };
export type ClientCheckin = {
  latest: { submittedAt: string; fields: CheckinField[] } | null;
  photos: CheckinPhoto[];
};

function fmtAnswer(type: string, value: unknown): string {
  if (value == null || value === '') return '-';
  if (type === 'rating') return `${value}/5`;
  if (type === 'sleep_duration') {
    if (typeof value === 'number') return `${value} hrs`;
    if (typeof value === 'object') {
      const o = value as { hours?: number; minutes?: number };
      return `${o.hours ?? 0}h${o.minutes ? ` ${o.minutes}m` : ''}`;
    }
  }
  if (typeof value === 'string') return value;
  return String(value);
}

/**
 * Just the latest submission, without the photos.
 *
 * Split out so the canonical client page can show a check-in without paying for twelve more signed
 * photo URLs it already loads elsewhere. getClientCheckin below still returns both, for the
 * check-in queue that genuinely wants the photos beside the answers.
 */
export async function getLatestCheckin(companyId: string, owner: CheckinOwner): Promise<ClientCheckin['latest']> {
  const filter = ownerFilter(owner);
  if (!filter) return null;
  const sb = createServiceClient();
  const { data: resp } = await sb
    .from('form_responses')
    .select('id, form_id, answers, submitted_at, forms!inner(type)')
    .eq('company_id', companyId)
    .or(filter)
    .eq('forms.type', 'check_in')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = resp as { form_id: string; answers: Record<string, unknown>; submitted_at: string } | null;
  if (!row) return null;
  const form = await getForm(companyId, row.form_id);
  const fields: CheckinField[] = (form?.fields ?? [])
    .map((f) => ({
      label: (f.label_en as string) || 'Field',
      type: f.type as string,
      value: fmtAnswer(f.type as string, row.answers?.[f.id as string]),
    }))
    .filter((f) => f.value !== '-');
  return { submittedAt: row.submitted_at, fields };
}

export async function getClientCheckin(companyId: string, owner: CheckinOwner): Promise<ClientCheckin> {
  const filter = ownerFilter(owner);
  if (!filter) return { latest: null, photos: [] };
  const sb = createServiceClient();

  // Latest check-in submission (join forms to restrict to type=check_in).
  const { data: resp } = await sb
    .from('form_responses')
    .select('id, form_id, answers, submitted_at, forms!inner(type)')
    .eq('company_id', companyId)
    .or(filter)
    .eq('forms.type', 'check_in')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let latest: ClientCheckin['latest'] = null;
  const row = resp as { form_id: string; answers: Record<string, unknown>; submitted_at: string } | null;
  if (row) {
    const form = await getForm(companyId, row.form_id);
    const fields: CheckinField[] = (form?.fields ?? [])
      .map((f) => ({
        label: (f.label_en as string) || 'Field',
        type: f.type as string,
        value: fmtAnswer(f.type as string, row.answers?.[f.id as string]),
      }))
      .filter((f) => f.value !== '-');
    latest = { submittedAt: row.submitted_at, fields };
  }

  // Progress photos (rows may exist without a storage object -> null url -> placeholder in the UI).
  const { data: photoRows } = await sb
    .from('progress_photos')
    .select('id, storage_path, taken_on, pose, weight_kg')
    .eq('company_id', companyId)
    .or(filter)
    .order('taken_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(12);
  const rows = (photoRows ?? []) as { id: string; storage_path: string; taken_on: string; pose: string | null; weight_kg: number | null }[];

  let urls = new Map<string, string>();
  if (rows.length > 0) {
    const { data: signed } = await sb.storage.from(PHOTO_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), SIGNED_TTL_SECONDS);
    urls = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]));
  }
  const photos: CheckinPhoto[] = rows.map((r) => ({
    id: r.id,
    url: urls.get(r.storage_path) ?? null,
    pose: r.pose,
    takenOn: r.taken_on,
    weightLb: r.weight_kg != null ? Math.round(Number(r.weight_kg) * KG_TO_LB * 10) / 10 : null,
  }));

  return { latest, photos };
}
