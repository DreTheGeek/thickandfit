// Recipe books shelf: cover cards linking into the recipe browser filtered by book.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getRecipeBooks } from '@/lib/coach/recipes';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { RecipeImage } from '@/components/coach/recipe-image';

export const dynamic = 'force-dynamic';

export default async function CoachRecipeBooksPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  if (!ctx.companyId) return <div className="p-8 text-sm text-muted">{t('noData')}</div>;
  const books = await getRecipeBooks(ctx.companyId);

  return (
    <div>
      <Eyebrow>{t('bucketNutrition')}</Eyebrow>
      <PageTitle className="mb-5 mt-1">{t('toolRecipeBooks')}</PageTitle>

      {books.length === 0 ? (
        <p className="py-16 text-center text-sm text-faint">{t('noData')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <Link
              key={b.id}
              href={`/coach/tool/recipes?book=${encodeURIComponent(b.name)}`}
              className="tf-press group overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-warm">
                <RecipeImage src={b.cover} alt={b.name} icon="book" sizes="360px" imgClassName="object-cover transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="p-4">
                <div className="text-[15px] font-semibold leading-snug">{b.name}</div>
                <div className="mt-1 text-[12px] text-faint">{t('recipeCountLabel', { count: b.count })}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
