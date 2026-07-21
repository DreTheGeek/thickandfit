// Company settings: the operator-editable support contact (and maintenance note) shown to members.
// Backs the admin_settings table. English-only ops tool.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getAdminSettings } from '@/lib/admin/settings';
import { AdminPage } from '@/components/admin/ui';
import { SettingsForm } from '@/components/admin/settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const settings = await getAdminSettings(ctx.companyId);
  return (
    <AdminPage
      title="Settings"
      subtitle="Support contact members see in the app. Blank fields fall back to the default."
    >
      <SettingsForm initial={settings} />
    </AdminPage>
  );
}
