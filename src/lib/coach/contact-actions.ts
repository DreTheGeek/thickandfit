'use server';
// Manually add or edit a CRM client contact (the CRM was import-only; a coach could not add or
// correct a client). Company-scoped + coach-gated + audit-logged. Email is unique-ish per company;
// creating a duplicate email returns a friendly error rather than a second row.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';

export type ContactResult = { ok: boolean; id?: string; error?: string };

const Base = z.object({
  firstName: z.string().trim().max(120).optional().default(''),
  lastName: z.string().trim().max(120).optional().default(''),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(''),
  language: z.enum(['en', 'es']).nullable().optional(),
  productType: z.string().trim().max(120).optional().default(''),
});

export async function createContactAction(input: unknown): Promise<ContactResult> {
  const parsed = Base.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const svc = createServiceClient();
  const d = parsed.data;

  const { data: dupe } = await svc
    .from('contacts')
    .select('id')
    .eq('company_id', ctx.companyId)
    .ilike('email', d.email)
    .maybeSingle();
  if (dupe) return { ok: false, error: 'duplicate' };

  const { data: row, error } = await svc
    .from('contacts')
    .insert({
      company_id: ctx.companyId,
      type: 'client',
      lifecycle_stage: 'active',
      first_name: d.firstName || null,
      last_name: d.lastName || null,
      email: d.email,
      phone: d.phone || null,
      language: d.language ?? null,
      product_type: d.productType || null,
      is_legacy: false,
      source: 'manual',
    })
    .select('id')
    .single();
  if (error) {
    console.error('createContactAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  const id = (row as { id: string }).id;
  logCoachAction(svc, { companyId: ctx.companyId, userId: ctx.userId, entityType: 'contact', entityId: id, action: 'contact.create', newState: { email: d.email } });
  revalidatePath('/coach/clients');
  return { ok: true, id };
}

const Edit = Base.extend({ id: z.string().uuid() });

export async function updateContactAction(input: unknown): Promise<ContactResult> {
  const parsed = Edit.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const svc = createServiceClient();
  const d = parsed.data;

  const { error } = await svc
    .from('contacts')
    .update({
      first_name: d.firstName || null,
      last_name: d.lastName || null,
      email: d.email,
      phone: d.phone || null,
      language: d.language ?? null,
      product_type: d.productType || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', d.id)
    .eq('company_id', ctx.companyId);
  if (error) {
    console.error('updateContactAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  logCoachAction(svc, { companyId: ctx.companyId, userId: ctx.userId, entityType: 'contact', entityId: d.id, action: 'contact.update' });
  revalidatePath('/coach/clients');
  revalidatePath(`/coach/clients/${d.id}`);
  return { ok: true, id: d.id };
}
