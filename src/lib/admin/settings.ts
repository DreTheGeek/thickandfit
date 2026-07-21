// Company support/settings, editable by an operator in /admin/settings. One row per company
// (admin_settings PK = company_id). Reads fall back to sensible defaults so the member support
// surfaces always have a contact even before an operator sets one.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type AdminSettings = {
  supportEmail: string;
  supportPhone: string | null;
  supportHours: string | null;
  maintenanceNote: string | null;
};

export const DEFAULT_SUPPORT_EMAIL = 'hello@teamthickandfit.com';

const DEFAULTS: AdminSettings = {
  supportEmail: DEFAULT_SUPPORT_EMAIL,
  supportPhone: null,
  supportHours: null,
  maintenanceNote: null,
};

type Row = {
  support_email: string | null;
  support_phone: string | null;
  support_hours: string | null;
  maintenance_note: string | null;
};

export async function getAdminSettings(companyId: string | null): Promise<AdminSettings> {
  if (!companyId) return DEFAULTS;
  const svc = createServiceClient();
  const { data } = await svc
    .from('admin_settings')
    .select('support_email, support_phone, support_hours, maintenance_note')
    .eq('company_id', companyId)
    .maybeSingle();
  const row = data as Row | null;
  if (!row) return DEFAULTS;
  return {
    supportEmail: row.support_email?.trim() || DEFAULTS.supportEmail,
    supportPhone: row.support_phone,
    supportHours: row.support_hours,
    maintenanceNote: row.maintenance_note,
  };
}

/** Just the member-facing support email (used by the app Help surfaces). */
export async function getSupportEmail(companyId: string | null): Promise<string> {
  return (await getAdminSettings(companyId)).supportEmail;
}
