'use server';
// Operator support-ticket actions: create (manual/log a ticket) + set status. Operator-gated.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOperator } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export type SupportResult = { ok: boolean; error?: string };

const NewTicket = z.object({
  subject: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  body: z.string().trim().max(5000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  category: z.string().trim().max(40).optional(),
});

export async function createTicketAction(input: unknown): Promise<SupportResult> {
  const parsed = NewTicket.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const svc = createServiceClient();
  const { error } = await svc.from('support_tickets').insert({
    company_id: ctx.companyId,
    subject: parsed.data.subject,
    email: parsed.data.email || null,
    body: parsed.data.body || null,
    priority: parsed.data.priority ?? 'normal',
    category: parsed.data.category || null,
    source: 'manual',
  });
  if (error) { console.error('createTicketAction:', error.message); return { ok: false, error: 'failed' }; }
  revalidatePath('/admin/support');
  return { ok: true };
}

const SetStatus = z.object({ id: z.string().uuid(), status: z.enum(['open', 'in_progress', 'resolved', 'closed']) });

export async function setTicketStatusAction(input: unknown): Promise<SupportResult> {
  const parsed = SetStatus.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const svc = createServiceClient();
  const done = parsed.data.status === 'resolved' || parsed.data.status === 'closed';
  const { error } = await svc
    .from('support_tickets')
    .update({ status: parsed.data.status, resolved_at: done ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('company_id', ctx.companyId);
  if (error) { console.error('setTicketStatusAction:', error.message); return { ok: false, error: 'failed' }; }
  revalidatePath('/admin/support');
  return { ok: true };
}
