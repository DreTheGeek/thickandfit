// Exercise library browser. Requires auth.
import { requireAuth } from '@/lib/auth/guards';
import { getUiLocale } from '@/lib/i18n/locale';
import { ExerciseBrowser } from '@/components/exercises/exercise-browser';

export const dynamic = 'force-dynamic';

export default async function ExercisesPage() {
  await requireAuth();
  const locale = await getUiLocale();
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-black">
      <h1 className="mb-6 text-3xl font-bold uppercase tracking-tight">Exercises</h1>
      <ExerciseBrowser locale={locale} />
    </main>
  );
}
