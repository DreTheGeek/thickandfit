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
  /** Operator switch for new account creation. See isSignupEnabled(). */
  signupEnabled: boolean;
};

export const DEFAULT_SUPPORT_EMAIL = 'hello@teamthickandfit.com';

const DEFAULTS: AdminSettings = {
  supportEmail: DEFAULT_SUPPORT_EMAIL,
  supportPhone: null,
  supportHours: null,
  maintenanceNote: null,
  // OPEN by default, and on every read failure below. A missing settings row, an unreachable DB, or
  // a company with nothing configured must not silently close the front door: an outage that turns
  // into "nobody can sign up" is far worse than one that leaves signups working.
  signupEnabled: true,
};

type Row = {
  support_email: string | null;
  support_phone: string | null;
  support_hours: string | null;
  maintenance_note: string | null;
  signup_enabled: boolean | null;
};

export async function getAdminSettings(companyId: string | null): Promise<AdminSettings> {
  if (!companyId) return DEFAULTS;
  const svc = createServiceClient();
  const { data } = await svc
    .from('admin_settings')
    .select('support_email, support_phone, support_hours, maintenance_note, signup_enabled')
    .eq('company_id', companyId)
    .maybeSingle();
  const row = data as Row | null;
  if (!row) return DEFAULTS;
  return {
    supportEmail: row.support_email?.trim() || DEFAULTS.supportEmail,
    supportPhone: row.support_phone,
    supportHours: row.support_hours,
    maintenanceNote: row.maintenance_note,
    // Only an explicit false closes signups. null (column added to an existing row) reads as open.
    signupEnabled: row.signup_enabled !== false,
  };
}

/**
 * Can a new account be created right now?
 *
 * Called from signUpAction, the OAuth callback, and the sign-up page. Fails OPEN: see DEFAULTS.
 */
export async function isSignupEnabled(companyId: string | null): Promise<boolean> {
  try {
    return (await getAdminSettings(companyId)).signupEnabled;
  } catch (e) {
    console.error('isSignupEnabled:', e instanceof Error ? e.message : e);
    return true;
  }
}

/** Just the member-facing support email (used by the app Help surfaces). */
export async function getSupportEmail(companyId: string | null): Promise<string> {
  return (await getAdminSettings(companyId)).supportEmail;
}
