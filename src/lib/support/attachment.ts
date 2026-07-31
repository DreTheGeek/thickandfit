import 'server-only';
// Support attachments: the screenshot a member takes OF THE BUG.
//
// This is the whole reason the feature exists. "It says an error" is unactionable; a screenshot of
// the actual error message usually contains the answer. So the constraints here are set by that use:
// the image must survive at readable resolution (no aggressive downscale), and it must be easy to
// send from a phone, which is where people notice bugs.
//
// PRIVATE BUCKET, SIGNED URLS. A bug screenshot routinely contains the member's own screen: their
// name, their macros, sometimes a payment form. A public URL would make that permanently reachable
// by anyone who ever saw the link, including through the Telegram alert. Nothing here is public; the
// admin view mints a short-lived signed URL at render time.
import { createServiceClient } from '@/lib/supabase/service';

const BUCKET = 'support-attachments';
/** Matches the bucket's own limit. Phone screenshots are typically 200KB-3MB. */
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']);
/** Long enough to read a ticket, short enough that a forwarded link dies quickly. */
export const SIGNED_TTL_SECONDS = 3600;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif',
};

/**
 * Store a data-URL screenshot. Returns the storage PATH (not a URL) so nothing durable ever holds a
 * link that could outlive its signature.
 *
 * Never throws: an attachment that fails to store must not cost the ticket. A ticket with a missing
 * screenshot is workable; a lost bug report is not.
 */
export async function storeAttachment(dataUrl: string, ticketHint: string): Promise<string | null> {
  try {
    const m = /^data:([a-z/+.-]+);base64,(.+)$/i.exec(dataUrl.trim());
    if (!m) return null;
    const mime = m[1].toLowerCase();
    if (!ALLOWED.has(mime)) {
      console.error('storeAttachment: rejected mime', mime);
      return null;
    }
    const bytes = Buffer.from(m[2], 'base64');
    if (bytes.length === 0 || bytes.length > MAX_BYTES) {
      console.error('storeAttachment: size out of bounds', bytes.length);
      return null;
    }
    // Path carries no member identity: the ticket row is the only join back to a person.
    const path = `${ticketHint}/${Date.now()}.${EXT[mime] ?? 'jpg'}`;
    const { error } = await createServiceClient()
      .storage.from(BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) {
      console.error('storeAttachment:', error.message);
      return null;
    }
    return path;
  } catch (e) {
    console.error('storeAttachment:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Mint a short-lived URL for viewing. Returns null on any failure so the page still renders. */
export async function signedAttachmentUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  // Legacy rows stored a full URL before the bucket existed; pass those through unchanged.
  if (/^https?:\/\//i.test(path)) return path;
  try {
    const { data, error } = await createServiceClient()
      .storage.from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL_SECONDS);
    if (error) {
      console.error('signedAttachmentUrl:', error.message);
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (e) {
    console.error('signedAttachmentUrl:', e instanceof Error ? e.message : e);
    return null;
  }
}
