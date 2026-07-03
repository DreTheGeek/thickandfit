'use server';
// Operator QA checklist actions. Internal ops tool (English-only by design, like the interview
// bank): the audience is the QA team, not members.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOperator } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export type QaResult = { ok: boolean };

const SetStatus = z.object({
  id: z.string().uuid(),
  status: z.enum(['todo', 'pass', 'fail', 'blocked']),
  notes: z.string().max(2000).optional(),
});

export async function setQaStatusAction(input: unknown): Promise<QaResult> {
  const parsed = SetStatus.safeParse(input);
  if (!parsed.success) return { ok: false };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false };
  const svc = createServiceClient();
  const { data: me } = await svc.from('profiles').select('email, full_name').eq('id', ctx.userId).maybeSingle();
  const who = ((me as { full_name: string | null; email: string | null } | null)?.full_name
    ?? (me as { email: string | null } | null)?.email
    ?? 'operator') as string;
  const { error } = await svc
    .from('qa_checklist')
    .update({
      status: parsed.data.status,
      notes: parsed.data.notes ?? null,
      checked_by: parsed.data.status === 'todo' ? null : who,
      checked_at: parsed.data.status === 'todo' ? null : new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('company_id', ctx.companyId);
  if (error) {
    console.error('setQaStatusAction:', error.message);
    return { ok: false };
  }
  revalidatePath('/admin');
  return { ok: true };
}
