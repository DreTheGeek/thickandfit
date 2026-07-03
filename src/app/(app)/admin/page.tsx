// Operator portal: the QA/bug-test board + ops quick links. Operator-ONLY (requireOperator) so
// Stephanie's coach view never grows ops clutter - her QA team signs in with operator accounts.
// Internal ops tool: English-only by design (the audience is the QA team, not members).
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireOperator } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/ui/page-header';
import { QaChecklist, type QaItem } from '@/components/admin/qa-checklist';

export const dynamic = 'force-dynamic';

const OPS_LINKS: { label: string; href: string }[] = [
  { label: 'Intelligence (scan accuracy)', href: '/coach/intelligence' },
  { label: 'System health map', href: '/coach/health' },
  { label: 'Billing & renewals', href: '/coach/billing' },
  { label: 'Business overview', href: '/coach' },
];

type Row = {
  id: string;
  category: string;
  title: string;
  detail: string | null;
  status: 'todo' | 'pass' | 'fail' | 'blocked';
  notes: string | null;
  checked_by: string | null;
};

export default async function AdminPage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  let items: QaItem[] = [];
  if (ctx.companyId) {
    const svc = createServiceClient();
    const { data } = await svc
      .from('qa_checklist')
      .select('id, category, title, detail, status, notes, checked_by')
      .eq('company_id', ctx.companyId)
      .order('category', { ascending: true })
      .order('sort', { ascending: true })
      .limit(500);
    items = ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      detail: r.detail,
      status: r.status,
      notes: r.notes,
      checkedBy: r.checked_by,
    }));
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <PageHeader title="Launch QA" />
      <p className="mb-4 text-[13px] text-muted">
        The full pre-launch test board. Open an item for the exact steps + expected result, then mark
        pass / fail / blocked with notes. Failures are the bug list.
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        {OPS_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="tf-press rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink"
          >
            {l.label}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-line p-6 text-center text-sm text-faint">
          No checklist yet. Seed it: node .qa-visual/seed-qa-checklist.cjs
        </p>
      ) : (
        <QaChecklist items={items} />
      )}
    </div>
  );
}
