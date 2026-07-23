// Team: create coach / assistant / operator accounts and email them a set-password link. The current
// team (everyone in this company holding a staff role) is listed below the form. English-only ops tool.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminPage, Card } from '@/components/admin/ui';
import { TeamInviteForm } from '@/components/admin/team-invite-form';
import { TeamRemoveButton } from '@/components/admin/team-remove-button';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  coach: 'Coach',
  assistant_coach: 'Assistant coach',
  operator: 'Operator',
};

type TeamRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
};

export default async function TeamPage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const svc = createServiceClient();
  const { data } = ctx.companyId
    ? await svc
        .from('profiles')
        .select('id, full_name, email, role, created_at')
        .eq('company_id', ctx.companyId)
        .in('role', ['coach', 'assistant_coach', 'operator'])
        .order('created_at', { ascending: true })
    : { data: [] };
  const team = (data ?? []) as TeamRow[];

  return (
    <AdminPage
      title="Team"
      subtitle="Create coach, assistant, and operator accounts. Each person gets an email to set their own password, then lands in the right console."
    >
      <TeamInviteForm />

      <Card title={`Current team (${team.length})`}>
        {team.length === 0 ? (
          <p className="text-[13px] text-muted">No staff accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                  <th className="pb-2 pr-4 font-semibold">Name</th>
                  <th className="pb-2 pr-4 font-semibold">Email</th>
                  <th className="pb-2 pr-4 font-semibold">Role</th>
                  <th className="pb-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id} className="border-t border-line">
                    <td className="py-2.5 pr-4 text-ink">{m.full_name ?? '(no name)'}</td>
                    <td className="py-2.5 pr-4 text-muted">{m.email ?? '-'}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full bg-warm px-2.5 py-0.5 text-[11px] font-semibold text-soft">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <TeamRemoveButton
                        id={m.id}
                        name={m.full_name?.trim() || m.email || 'this teammate'}
                        isSelf={m.id === ctx.userId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
