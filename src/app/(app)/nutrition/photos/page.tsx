// Client food-photo check-in diary (call 2026-07-01). Upload meal photos for the coach to review.
import type { ReactElement } from 'react';
import { requireEntitled } from '@/lib/auth/guards';
import { listMyFoodPhotos } from '@/lib/food-photos/actions';
import { FoodPhotosScreen } from '@/components/nutrition/food-photos-screen';

export const dynamic = 'force-dynamic';

export default async function FoodPhotosPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const photos = await listMyFoodPhotos();
  return <FoodPhotosScreen initialPhotos={photos} profileId={ctx.userId} />;
}
