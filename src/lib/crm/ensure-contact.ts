import 'server-only';
// Bridges an app member into the Clients CRM. The auth trigger creates a profiles row on signup but
// nothing ever wrote a contacts row, so new members never surfaced at /coach/clients. Runs at
// onboarding submit, the earliest point the member's real name exists. Idempotent per profile:
//   1. a contact already linked to this profile -> no-op (covers claimed legacy clients)
//   2. an unclaimed non-legacy contact with the member's email (GHL/manual lead) -> link it and
//      convert to client. Unclaimed LEGACY contacts are left untouched: claim_legacy_contact()
//      owns that link (and kicks off the photo import), so linking here would break the claim.
//   3. otherwise -> insert a fresh client contact.
import { createServiceClient } from '@/lib/supabase/service';

export type EnsureContactInput = {
  profileId: string;
  companyId: string;
  firstName: string;
  lastName: string;
  language?: 'en' | 'es' | null;
};

type MatchRow = {
  id: string;
  type: string;
  is_legacy: boolean;
  first_name: string | null;
  last_name: string | null;
  language: string | null;
};

export async function ensureCrmContact(input: EnsureContactInput): Promise<void> {
  const svc = createServiceClient();

  const { data: linked } = await svc
    .from('contacts')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('profile_id', input.profileId)
    .limit(1)
    .maybeSingle();
  if (linked) return;

  const { data: prof } = await svc
    .from('profiles')
    .select('email')
    .eq('id', input.profileId)
    .maybeSingle();
  const email = ((prof as { email?: string | null } | null)?.email ?? '').trim();
  if (!email) return;

  // Escape ilike wildcards: '_' is legal in emails and would otherwise match any character.
  const emailPattern = email.replace(/[\\%_]/g, '\\$&');
  const { data: matchRows } = await svc
    .from('contacts')
    .select('id, type, is_legacy, first_name, last_name, language')
    .eq('company_id', input.companyId)
    .ilike('email', emailPattern)
    .is('profile_id', null)
    .limit(1);
  const match = ((matchRows ?? []) as MatchRow[])[0] ?? null;

  if (match) {
    if (match.is_legacy) return; // claim_legacy_contact() owns legacy linking
    const { error } = await svc
      .from('contacts')
      .update({
        profile_id: input.profileId,
        type: 'client',
        lifecycle_stage: 'active',
        ...(match.type === 'lead' ? { was_lead: true } : {}),
        ...(match.first_name ? {} : { first_name: input.firstName }),
        ...(match.last_name ? {} : { last_name: input.lastName }),
        ...(match.language || !input.language ? {} : { language: input.language }),
      })
      .eq('id', match.id);
    if (error) throw new Error(`ensureCrmContact link: ${error.message}`);
    return;
  }

  const { error } = await svc.from('contacts').insert({
    company_id: input.companyId,
    type: 'client',
    lifecycle_stage: 'active',
    first_name: input.firstName,
    last_name: input.lastName,
    email,
    language: input.language ?? null,
    is_legacy: false,
    source: 'app',
    profile_id: input.profileId,
  });
  if (error) throw new Error(`ensureCrmContact insert: ${error.message}`);
}
