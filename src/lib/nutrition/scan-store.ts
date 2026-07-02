// Persist the (client-downscaled) scan image keyed by its inference id, so corrected real scans
// become gold eval cases automatically: ai_inferences.correction supplies the label, this supplies
// the pixels. Private food-photos bucket under the reserved ai-scans/ folder (can never collide
// with the auth.uid() owner folders; readable only server-side via the service client).
// Fire-and-forget BY CONTRACT: storeScanImage swallows every failure. A storage blip must never
// fail or slow a scan - callers invoke it with `void` AFTER the response-critical work.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

const BUCKET = 'food-photos';

export async function storeScanImage(inferenceId: string, image: string): Promise<void> {
  try {
    // Only data URLs are stored (the normal client path). Remote http(s) inputs are rare and
    // already durable at their source; re-hosting them buys nothing.
    const m = image.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
    if (!m) return;
    const ext = m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpg';
    const bytes = Buffer.from(m[2], 'base64');
    if (bytes.length === 0 || bytes.length > 8_000_000) return; // sanity bounds
    const svc = createServiceClient();
    const { error } = await svc.storage
      .from(BUCKET)
      .upload(`ai-scans/${inferenceId}.${ext}`, bytes, {
        contentType: `image/${m[1] === 'jpg' ? 'jpeg' : m[1]}`,
        upsert: true,
      });
    if (error) console.error('storeScanImage:', error.message);
  } catch (e) {
    console.error('storeScanImage exception:', e instanceof Error ? e.message : String(e));
  }
}
