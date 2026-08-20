import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * The photo she took, next to the meal it became.
 *
 * The handoff's Fuel screen puts a thumbnail on every meal row, and it is the difference between a
 * diary that reads like a spreadsheet and one that reads like her day. The pixels already exist:
 * scan-store.ts writes every scanned image to `food-photos/ai-scans/{inferenceId}.{ext}` so that
 * corrected scans become gold eval cases, and `food_log.ai_inference_id` is the key back to it.
 * Nothing had ever read it for display.
 *
 * MOST ROWS HAVE NO PHOTO AND THAT IS PERMANENT, not a gap waiting to fill. Search, barcode and
 * text-to-macro logs never had an image, and the Lenus import brought 8,419 rows that never will.
 * So the caller needs a fallback tile rather than a broken image, and this returns a Map with
 * misses simply absent.
 *
 * THE EXTENSION IS NOT KNOWN FROM THE ROW. scan-store keeps whatever the client sent (jpg, png or
 * webp), and food_log records only the inference id. Rather than list the bucket, which does not
 * scale and pages, this signs the jpg candidates in one call and retries only the misses against
 * the other two. The client downscales to JPEG at q0.82 before every scan, so the first pass hits
 * essentially always and the retry is there for older rows.
 */

const BUCKET = 'food-photos';
const EXTS = ['jpg', 'png', 'webp'] as const;
/** One hour, matching the exercise-demo signer. Long enough for a session, short enough to expire. */
const TTL_SECONDS = 3600;

export async function getMealThumbs(inferenceIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(inferenceIds.filter((v): v is string => typeof v === 'string' && v.length > 0))];
  if (ids.length === 0) return out;

  const svc = createServiceClient();

  // Pass 1: jpg for everything. Pass 2 and 3: only what pass 1 could not resolve.
  let pending = ids;
  for (const ext of EXTS) {
    if (pending.length === 0) break;
    const paths = pending.map((id) => `ai-scans/${id}.${ext}`);
    const { data, error } = await svc.storage.from(BUCKET).createSignedUrls(paths, TTL_SECONDS);
    if (error) {
      // Fail soft: a signing outage should cost thumbnails, not the diary.
      console.error('getMealThumbs:', error.message);
      return out;
    }
    const missed: string[] = [];
    (data ?? []).forEach((row, i) => {
      const id = pending[i];
      if (row?.signedUrl && !row.error) out.set(id, row.signedUrl);
      else missed.push(id);
    });
    pending = missed;
  }

  return out;
}
