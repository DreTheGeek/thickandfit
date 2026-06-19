// Generic placeholder for Library tools whose builder lands in a later phase. The sidebar
// already organizes them; each gets its own honest "coming soon" page.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { AdminPlaceholder } from '@/components/coach/admin-placeholder';

export const dynamic = 'force-dynamic';

const SLUG_TO_KEY: Record<string, string> = {
  'training-templates': 'toolTrainingTemplates',
  exercises: 'toolExercises',
  'exercise-blocks': 'toolExerciseBlocks',
  recipes: 'toolRecipes',
  'recipe-books': 'toolRecipeBooks',
  'meal-plans': 'toolMealPlans',
  ingredients: 'toolIngredients',
  habits: 'toolHabits',
  'content-collections': 'toolContentCollections',
  'media-library': 'toolMediaLibrary',
  benefits: 'toolBenefits',
  products: 'toolProducts',
  automations: 'toolAutomations',
  flows: 'toolFlows',
  tags: 'toolTags',
  social: 'toolSocial',
};

export default async function CoachToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactElement> {
  await requireCoach();
  const { slug } = await params;
  const t = await getTranslations('app.coach');
  const key = SLUG_TO_KEY[slug] ?? 'library';
  return <AdminPlaceholder title={t(key)} />;
}
