// Client workout history. Requires auth. Grouped newest-first; the coach view of the same data
// lives in the client profile Training tab (reads /api/workouts/history?profile_id).
import { requireAuth } from '@/lib/auth/guards';
import { fetchHistory } from '@/lib/workout/logging';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const ctx = await requireAuth();
  const history = ctx.companyId ? await fetchHistory(ctx.companyId, ctx.userId) : [];

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10 md:px-10">
      <PageHeader title="Training history" />
      {history.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No workouts logged yet. Finish a session and it shows up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between border border-neutral-200 p-4 transition-colors hover:border-ink"
            >
              <span className="text-sm text-ink">
                {new Date(h.performed_at).toLocaleDateString()}
              </span>
              <span className="text-xs uppercase tracking-wide text-neutral-400">
                {h.completion_pct != null ? `${h.completion_pct}%` : '-'}
                {h.enjoyment != null ? ` · enjoy ${h.enjoyment}/5` : ''}
                {h.effort != null ? ` · effort ${h.effort}/5` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
