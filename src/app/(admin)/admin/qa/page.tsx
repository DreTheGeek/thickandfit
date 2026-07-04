// Launch QA board: the full pre-launch test board + team access (grant operators). Guarded by the
// (admin) layout (operator + passcode), so no per-page gate needed here.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { QaChecklist, type QaItem } from '@/components/admin/qa-checklist';
import { TeamAccess } from '@/components/admin/admin-gate';
import { AdminPage, Card } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; category: string; title: string; detail: string | null; status: 'todo' | 'pass' | 'fail' | 'blocked';
  notes: string | null; checked_by: string | null; phase: string | null; phase_order: number | null; area: string | null;
  should_do: string | null; how_to_trigger: string | null; expected_result: string | null; involves_ghl: boolean | null; assigned_tester: string | null; priority: string | null;
};

export default async function AdminQaPage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  let items: QaItem[] = [];
  let operators: { name: string; email: string }[] = [];
  if (ctx.companyId) {
    const svc = createServiceClient();
    const [{ data }, { data: ops }] = await Promise.all([
      svc.from('qa_checklist')
        .select('id, category, title, detail, status, notes, checked_by, phase, phase_order, area, should_do, how_to_trigger, expected_result, involves_ghl, assigned_tester, priority')
        .eq('company_id', ctx.companyId)
        .order('phase_order', { ascending: true }).order('area', { ascending: true }).order('sort', { ascending: true }).limit(1000),
      svc.from('profiles').select('full_name, email').eq('company_id', ctx.companyId).eq('role', 'operator'),
    ]);
    items = ((data ?? []) as Row[]).map((r) => ({
      id: r.id, category: r.category, title: r.title, detail: r.detail, status: r.status, notes: r.notes, checkedBy: r.checked_by,
      phase: r.phase, phaseOrder: r.phase_order ?? 99, area: r.area, shouldDo: r.should_do, howToTrigger: r.how_to_trigger,
      expectedResult: r.expected_result, involvesGhl: !!r.involves_ghl, priority: r.priority, assignedTester: r.assigned_tester,
    }));
    operators = ((ops ?? []) as { full_name: string | null; email: string | null }[]).map((o) => ({ name: o.full_name ?? '', email: o.email ?? '' }));
  }

  return (
    <AdminPage title="Launch QA board" subtitle="Every feature + test item. Open a row for steps, mark pass/fail/blocked.">
      <TeamAccess operators={operators} />
      {items.length === 0 ? (
        <Card>No checklist yet. Seed it: node .qa-visual/seed-qa-checklist.cjs</Card>
      ) : (
        <QaChecklist items={items} />
      )}
    </AdminPage>
  );
}
