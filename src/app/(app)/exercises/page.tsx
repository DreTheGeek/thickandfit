// Exercise library browser. Requires auth.
import { requireAuth } from '@/lib/auth/guards';
import { getUiLocale } from '@/lib/i18n/locale';
import { ExerciseBrowser } from '@/components/exercises/exercise-browser';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function ExercisesPage() {
  await requireAuth();
  const locale = await getUiLocale();
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10">
      <PageHeader title="Exercises" />
      <ExerciseBrowser locale={locale} />
    </div>
  );
}
