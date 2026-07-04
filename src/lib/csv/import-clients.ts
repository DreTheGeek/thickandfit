'use server';
// Bulk-import clients from a CSV (coach CRM). Accepts headers first_name,last_name,email,phone,
// language,product,notes (case-insensitive; email is the key). Upserts by email within the company:
// existing contacts are updated, new ones created as legacy=false clients. Never touches another
// company's rows. Returns a per-row outcome summary so the coach sees exactly what happened.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { parseCsv } from '@/lib/csv/csv';

export type ImportResult = {
  ok: boolean;
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
};

const emailSchema = z.string().email();

export async function importClientsCsvAction(csvText: unknown): Promise<ImportResult> {
  if (typeof csvText !== 'string' || csvText.length > 5_000_000) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  let rows: Record<string, string>[];
  try {
    rows = parseCsv(csvText);
  } catch {
    return { ok: false, error: 'parse_failed' };
  }
  if (rows.length === 0) return { ok: false, error: 'empty' };
  if (rows.length > 5000) return { ok: false, error: 'too_many' };

  const svc = createServiceClient();
  // Existing contacts by email (to decide create vs update) - one query.
  const emails = rows.map((r) => (r.email || '').trim().toLowerCase()).filter(Boolean);
  const { data: existing } = await svc
    .from('contacts')
    .select('id, email')
    .eq('company_id', ctx.companyId)
    .in('email', emails.length ? emails : ['__none__']);
  const byEmail = new Map(
    ((existing ?? []) as { id: string; email: string | null }[]).map((c) => [(c.email || '').toLowerCase(), c.id]),
  );

  let created = 0, updated = 0, skipped = 0;
  const errors: string[] = [];
  const g = (r: Record<string, string>, ...keys: string[]): string => {
    for (const k of keys) if (r[k]) return r[k].trim();
    return '';
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email = g(r, 'email').toLowerCase();
    if (!email || !emailSchema.safeParse(email).success) {
      skipped++;
      if (errors.length < 20) errors.push(`Row ${i + 2}: missing/invalid email`);
      continue;
    }
    const firstName = g(r, 'first_name', 'first name', 'firstname') || null;
    const lastName = g(r, 'last_name', 'last name', 'lastname') || null;
    const phone = g(r, 'phone', 'phone number') || null;
    const langRaw = g(r, 'language', 'lang').toLowerCase();
    const language = langRaw === 'es' || langRaw === 'spanish' ? 'es' : langRaw === 'en' || langRaw === 'english' ? 'en' : null;
    const productType = g(r, 'product', 'product_type', 'tier') || null;

    const fields = {
      company_id: ctx.companyId,
      type: 'client' as const,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      language,
      product_type: productType,
      source: 'csv_import',
      updated_at: new Date().toISOString(),
    };

    const existingId = byEmail.get(email);
    if (existingId) {
      const { error } = await svc.from('contacts').update(fields).eq('id', existingId).eq('company_id', ctx.companyId);
      if (error) { if (errors.length < 20) errors.push(`Row ${i + 2}: ${error.message}`); skipped++; }
      else updated++;
    } else {
      const { error } = await svc.from('contacts').insert({ ...fields, is_legacy: false, lifecycle_stage: 'active' });
      if (error) { if (errors.length < 20) errors.push(`Row ${i + 2}: ${error.message}`); skipped++; }
      else { created++; byEmail.set(email, 'new'); }
    }
  }

  revalidatePath('/coach/clients');
  return { ok: true, created, updated, skipped, errors };
}
