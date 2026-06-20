'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';

const inputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  definition: z.record(z.string(), z.unknown()),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'list'}-${Date.now().toString(36).slice(-4)}`;
}

export async function createSavedSegment(input: {
  name: string;
  definition: Record<string, unknown>;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const sb = createServiceClient();
  const slug = slugify(parsed.data.name);
  const { data, error } = await sb
    .from('saved_segments')
    .insert({
      company_id: ctx.companyId,
      created_by: ctx.userId,
      scope: 'client',
      name: parsed.data.name,
      slug,
      definition: parsed.data.definition,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'insert_failed' };

  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'saved_segment',
    entityId: data.id,
    action: 'create',
    newState: { name: parsed.data.name, slug, definition: parsed.data.definition },
  });
  revalidatePath('/coach/clients');
  return { ok: true, id: data.id };
}

export async function deleteSavedSegment(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const sb = createServiceClient();
  const { error } = await sb.from('saved_segments').delete().eq('id', id).eq('company_id', ctx.companyId);
  if (error) return { ok: false, error: error.message };
  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'saved_segment',
    entityId: id,
    action: 'delete',
  });
  revalidatePath('/coach/clients');
  return { ok: true };
}
