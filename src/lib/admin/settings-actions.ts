'use server';
// Operator edits the company's support settings (one admin_settings row per company). Internal ops
// tool, English-only.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOperator } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';

export type SettingsResult = { ok: boolean; error?: string };

const schema = z.object({
  supportEmail: z.string().trim().email().or(z.literal('')),
  supportPhone: z.string().trim().max(40).optional(),
  supportHours: z.string().trim().max(120).optional(),
  maintenanceNote: z.string().trim().max(500).optional(),
});

export async function saveAdminSettingsAction(input: unknown): Promise<SettingsResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const svc = createServiceClient();
  const { error } = await svc.from('admin_settings').upsert(
    {
      company_id: ctx.companyId,
      support_email: parsed.data.supportEmail || null,
      support_phone: parsed.data.supportPhone || null,
      support_hours: parsed.data.supportHours || null,
      maintenance_note: parsed.data.maintenanceNote || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' },
  );
  if (error) {
    console.error('saveAdminSettingsAction:', error.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'admin_settings',
    entityId: ctx.companyId,
    action: 'admin.save_settings',
  });
  revalidatePath('/admin/settings');
  return { ok: true };
}
