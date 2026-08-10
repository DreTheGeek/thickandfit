import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * A playable URL for one of her filmed demos.
 *
 * The bucket is PRIVATE, matching progress-photos (0032): her footage is the product, and a public
 * bucket would hand the whole library to anyone who guessed a filename. So the URL is minted
 * server-side, per request, and expires.
 *
 * One hour, same as the progress-photo reads. Long enough that a coach can scrub through a page of
 * demos without a link dying mid-play, short enough that a URL pasted into a group chat stops
 * working the same afternoon.
 */
const BUCKET = 'lenus-coach-media';
const TTL_SECONDS = 3600;

export async function demoUrl(storagePath: string | null): Promise<string | null> {
  if (!storagePath) return null;
  const sb = createServiceClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, TTL_SECONDS);
  // A missing file must not take the page down. The player renders its "no footage yet" state,
  // which is the honest reading: the row points at something the bucket does not have.
  if (error) {
    console.error('[demoUrl]', storagePath, error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Resolve one exercise's demo straight to a playable URL.
 *
 * The storage path deliberately never reaches the browser. It grants nothing on its own (the bucket
 * is private), but the detail page is the only caller that needs it and keeping it server-side means
 * there is no path in the DOM to enumerate the library from.
 */
export async function getExerciseDemoUrl(companyId: string, exerciseId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('exercises')
    .select('demo_storage_path')
    .eq('id', exerciseId)
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .maybeSingle<{ demo_storage_path: string | null }>();
  return demoUrl(data?.demo_storage_path ?? null);
}

/** Batch version for a page of cards, one round trip instead of forty. */
export async function demoUrls(paths: readonly string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter(Boolean))];
  if (!wanted.length) return new Map();
  const sb = createServiceClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(wanted, TTL_SECONDS);
  if (error) {
    console.error('[demoUrls]', error.message);
    return new Map();
  }
  const out = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.path && row.signedUrl && !row.error) out.set(row.path, row.signedUrl);
  }
  return out;
}
