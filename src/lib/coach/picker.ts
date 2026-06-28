// Picker reads for the WP8 surfaces (PRD-30). Two id spaces live here on purpose:
//   - listClientsForApprover: subscriber PROFILES (profiles id) - the message-draft recipient space.
//   - listContactsForDraft:   CRM CONTACTS (contacts id) - the meal-plan target space.
// These are DIFFERENT id spaces (messages.client_id -> profiles, meal_plans.contact_id -> contacts), so
// the composer offers both: a profile recipient (who the draft is "for") and, for meal plans, a contact
// target. Service client (server-only); company_id is pinned by the caller from ctx.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import type { CoachProfileLite } from '@/lib/coach/assignments';

// Subscriber/free profiles in the tenant - the recipient space an approver may draft for (an assistant
// is narrowed to their assignments via listAssignedClients instead).
export async function listClientsForApprover(companyId: string): Promise<CoachProfileLite[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('profiles')
    .select('id, full_name, email')
    .eq('company_id', companyId)
    .in('role', ['subscriber', 'free'])
    .order('full_name', { ascending: true })
    .limit(1000);
  const rows = (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
  return rows.map((p) => ({ id: p.id, name: (p.full_name || p.email || 'Unknown').trim() }));
}

// CRM contacts (contacts id space) - the meal_plans.contact_id target options. Capped for the picker.
export async function listContactsForDraft(companyId: string): Promise<CoachProfileLite[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('contacts')
    .select('id, first_name, last_name, email')
    .eq('company_id', companyId)
    .eq('type', 'client')
    .order('created_at', { ascending: false })
    .limit(500);
  const rows = (data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }[];
  return rows.map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Unknown',
  }));
}
