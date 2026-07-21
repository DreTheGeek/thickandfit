// Check-ins surface: the published check-in forms a coach has assigned to this client, each flagged
// with whether the client already submitted it in the last 24h. Reuses the form builder (type='check_in')
// and the existing /forms/[id] renderer; this just lists what is assigned.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type AssignedCheckin = {
  formId: string;
  titleEn: string;
  titleEs: string | null;
  doneRecently: boolean;
};

export async function getAssignedCheckins(
  companyId: string,
  profileId: string,
): Promise<AssignedCheckin[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('form_assignments')
    .select('form_id, forms!inner ( id, title_en, title_es, type, status )')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .eq('forms.type', 'check_in')
    .eq('forms.status', 'published');

  type Row = { form_id: string; forms: { title_en: string; title_es: string | null } | null };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.forms);
  if (rows.length === 0) return [];

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: resp } = await sb
    .from('form_responses')
    .select('form_id')
    .eq('profile_id', profileId)
    .gte('created_at', since);
  const doneSet = new Set(((resp ?? []) as { form_id: string }[]).map((r) => r.form_id));

  return rows.map((r) => ({
    formId: r.form_id,
    // Optional-chain the joined form: if RLS ever filters the relation to null, fall back to an empty
    // label instead of throwing on `.title_en` of null.
    titleEn: r.forms?.title_en ?? '',
    titleEs: r.forms?.title_es ?? '',
    doneRecently: doneSet.has(r.form_id),
  }));
}
