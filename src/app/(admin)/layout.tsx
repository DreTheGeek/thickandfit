// Operator/admin portal layout: its OWN shell (no coaching console). Every /admin* page is gated by
// the operator role AND the admin passcode here, so the whole portal is protected in one place.
import type { ReactElement, ReactNode } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { hasAdminGateAccess } from '@/lib/admin/passcode';
import { AdminPasscodeGate } from '@/components/admin/admin-gate';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  await requireOperator();
  if (!(await hasAdminGateAccess())) {
    return <AdminPasscodeGate />;
  }
  return <AdminShell>{children}</AdminShell>;
}
