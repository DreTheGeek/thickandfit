// Form builder engine. Company-scoped via the caller's companyId. Field order = array index.
import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

const fieldSchema = z.object({
  type: z.enum(['text', 'multiline', 'select', 'rating', 'sleep_duration', 'photo', 'measurement']),
  label_en: z.string().min(1),
  label_es: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  required: z.boolean().default(false),
});

export const saveFormSchema = z.object({
  id: z.string().uuid().optional(),
  title_en: z.string().min(1),
  title_es: z.string().optional(),
  type: z.enum(['onboarding', 'check_in', 'custom']).default('custom'),
  fields: z.array(fieldSchema),
});
export type SaveFormInput = z.infer<typeof saveFormSchema>;

export async function saveForm(companyId: string, createdBy: string, input: SaveFormInput) {
  const supabase = createServiceClient();
  let formId = input.id;

  if (formId) {
    await supabase
      .from('forms')
      .update({ title_en: input.title_en, title_es: input.title_es ?? null, type: input.type })
      .eq('id', formId)
      .eq('company_id', companyId);
  } else {
    const { data } = await supabase
      .from('forms')
      .insert({ company_id: companyId, title_en: input.title_en, title_es: input.title_es ?? null, type: input.type, created_by: createdBy })
      .select('id')
      .single();
    formId = data?.id;
  }
  if (!formId) throw new Error('Save failed');

  // Replace fields, sort_order = array index (this is how reorder persists).
  await supabase.from('form_fields').delete().eq('form_id', formId).eq('company_id', companyId);
  if (input.fields.length) {
    const rows = input.fields.map((f, i) => ({
      company_id: companyId,
      form_id: formId,
      type: f.type,
      label_en: f.label_en,
      label_es: f.label_es ?? null,
      config: f.config,
      required: f.required,
      sort_order: i,
    }));
    await supabase.from('form_fields').insert(rows);
  }
  return { formId };
}

export async function getForm(companyId: string, formId: string) {
  const supabase = createServiceClient();
  const { data: form } = await supabase
    .from('forms')
    .select('id, title_en, title_es, type, status, version')
    .eq('id', formId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!form) return null;
  const { data: fields } = await supabase
    .from('form_fields')
    .select('id, type, label_en, label_es, config, required, sort_order')
    .eq('form_id', formId)
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true });
  return { form, fields: fields ?? [] };
}

export async function publishForm(companyId: string, formId: string) {
  const supabase = createServiceClient();
  await supabase.from('forms').update({ status: 'published' }).eq('id', formId).eq('company_id', companyId);
  return { published: true };
}

export async function assignForm(companyId: string, formId: string, profileId: string) {
  const supabase = createServiceClient();

  // Ownership guard: never trust client-supplied ids. The form and the target
  // profile must both belong to this company before we upsert the assignment.
  const { data: form } = await supabase
    .from('forms')
    .select('id')
    .eq('id', formId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!form) throw new Error('Form not found');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!profile) throw new Error('Profile not found');

  await supabase
    .from('form_assignments')
    .upsert({ company_id: companyId, form_id: formId, profile_id: profileId }, { onConflict: 'form_id,profile_id' });
  return { assigned: true };
}

export async function submitResponse(
  companyId: string,
  formId: string,
  profileId: string,
  answers: Record<string, unknown>,
) {
  const supabase = createServiceClient();
  const { data: form } = await supabase
    .from('forms')
    .select('id, status, version')
    .eq('id', formId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!form || form.status !== 'published') throw new Error('Form not available');

  const { data: assigned } = await supabase
    .from('form_assignments')
    .select('id')
    .eq('form_id', formId)
    .eq('profile_id', profileId)
    .maybeSingle();
  if (!assigned) throw new Error('Not assigned');

  const { data: fields } = await supabase.from('form_fields').select('id, required').eq('form_id', formId);
  for (const f of fields ?? []) {
    const v = answers[f.id];
    if (f.required && (v === undefined || v === null || v === '')) throw new Error('Missing required answer');
  }

  const { data } = await supabase
    .from('form_responses')
    .insert({ company_id: companyId, form_id: formId, profile_id: profileId, answers, form_version: form.version })
    .select('id')
    .single();
  return { responseId: data?.id };
}

export async function fetchResponses(companyId: string, formId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('form_responses')
    .select('id, profile_id, answers, submitted_at')
    .eq('form_id', formId)
    .eq('company_id', companyId)
    .order('submitted_at', { ascending: false });
  return data ?? [];
}
