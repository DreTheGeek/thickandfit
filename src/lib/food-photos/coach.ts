// Coach-side read of a client's food-photo diary. Company-scoped; the coach signs the client's
// object paths with the service client (bypasses the owner-only storage RLS by design).
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import type { FoodPhoto } from '@/lib/food-photos/actions';

const BUCKET = 'food-photos';
const SIGNED_TTL_SECONDS = 60 * 60;

export async function getClientFoodPhotos(companyId: string, clientId: string, limit = 60): Promise<FoodPhoto[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('food_photos')
    .select('id, storage_path, taken_on, caption, meal_slot')
    .eq('company_id', companyId)
    .eq('profile_id', clientId)
    .order('taken_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!data || data.length === 0) return [];

  const { data: signed } = await sb.storage
    .from(BUCKET)
    .createSignedUrls(data.map((r) => r.storage_path), SIGNED_TTL_SECONDS);
  const urls = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl]));
  return data.map((r) => ({
    id: r.id,
    storagePath: r.storage_path,
    takenOn: r.taken_on,
    caption: r.caption,
    mealSlot: r.meal_slot,
    url: urls.get(r.storage_path) ?? null,
  }));
}
