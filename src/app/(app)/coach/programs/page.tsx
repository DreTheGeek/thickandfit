// Coach programs list. Coach-guarded. The full 3-pane interactive builder is layered on top of
// the proven /api/programs engine; this is the entry surface.
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export default async function CoachProgramsPage() {
  const ctx = await requireCoach();
  const supabase = createServiceClient();
  const { data: plans } = ctx.companyId
    ? await supabase
        .from('plans')
        .select('id, name_en, weeks, is_template, updated_at')
        .eq('company_id', ctx.companyId)
        .order('updated_at', { ascending: false })
    : { data: [] };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-black">
      <h1 className="mb-6 text-3xl font-bold uppercase tracking-tight">Programs</h1>
      {!plans || plans.length === 0 ? (
        <p className="text-sm text-neutral-600">No programs yet. Build one to assign to clients.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {plans.map((p) => (
            <li key={p.id} className="flex items-center justify-between border border-neutral-200 p-4">
              <span className="font-medium">{p.name_en}</span>
              <span className="text-xs uppercase tracking-wide text-neutral-500">
                {p.weeks}w{p.is_template ? ' · template' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
