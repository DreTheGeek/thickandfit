'use server';

// Server actions for the protocols surface.
//
// EXPORT RULE: a 'use server' module may export async functions and nothing else. A single exported
// const in here 500s EVERY action in the file, so the copy map and the pure helpers live in
// ./copy.ts and ./types.ts. Type exports are erased at compile time and are safe.
//
// GUARDS ARE NOT UNIFORM ON PURPOSE:
//   - sending / completing / recording a delivered plan uses requireCoach, because Daniella
//     (assistant_coach) runs the day-to-day onboarding and this is a fixed template, not a judgement
//     call about one client.
//   - approving the Spanish uses requireApprover (coach + operator, NOT assistant), because that
//     publishes copy in Stephanie's voice to Spanish-speaking members. It is her IP; the assistant
//     may write the draft, only she may sign it off.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireApprover, requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { localDay } from '@/lib/datetime/local-day';
import { endsOnFor } from '@/lib/protocols/types';

export type ProtocolActionResult = { ok: boolean; error?: string };
export type AssignProtocolResult = ProtocolActionResult & { endsOn?: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const AssignInput = z.object({
  protocolId: z.string().uuid(),
  contactId: z.string().uuid(),
  locale: z.enum(['en', 'es']),
  // Optional: the coach can backdate a protocol she sent by hand yesterday. Absent means today in
  // HER timezone, resolved server-side so a browser clock cannot decide a client's end date.
  sentOn: z.string().regex(ISO_DATE).nullable().default(null),
});

/** Postgres unique-violation. The partial index uidx_protocol_assignments_active raises it. */
function isDuplicate(code: string | undefined): boolean {
  return code === '23505';
}

/**
 * Put one client on one protocol, and record the day it ends.
 *
 * ends_on is computed HERE and stored, not derived on read: it is the promise made on the day it was
 * sent, and editing the template's duration later must not quietly move a live client's date.
 */
export async function assignProtocolAction(input: unknown): Promise<AssignProtocolResult> {
  const parsed = AssignInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const { protocolId, contactId, locale } = parsed.data;

  const sb = createServiceClient();
  const { data: protocolRow, error: protocolError } = await sb
    .from('protocols')
    .select('id, duration_days, es_status')
    .eq('company_id', ctx.companyId)
    .eq('id', protocolId)
    .maybeSingle();
  if (protocolError) {
    console.error('assignProtocolAction protocol:', protocolError.message);
    return { ok: false, error: 'failed' };
  }
  const protocol = protocolRow as { duration_days: number; es_status: string } | null;
  if (!protocol) return { ok: false, error: 'not_found' };

  // The Spanish gate. Her copy is not served in Spanish until she has approved the translation.
  if (locale === 'es' && protocol.es_status !== 'approved') return { ok: false, error: 'es_not_approved' };

  // Contact must belong to this tenant. The service client bypasses RLS, so this check IS the check.
  const { data: contactRow, error: contactError } = await sb
    .from('contacts')
    .select('id, profile_id')
    .eq('company_id', ctx.companyId)
    .eq('id', contactId)
    .maybeSingle();
  if (contactError) {
    console.error('assignProtocolAction contact:', contactError.message);
    return { ok: false, error: 'failed' };
  }
  const contact = contactRow as { profile_id: string | null } | null;
  if (!contact) return { ok: false, error: 'not_found' };

  const timezone = await getProfileTimezone(ctx.userId);
  const sentOn = parsed.data.sentOn ?? localDay(timezone);
  const endsOn = endsOnFor(sentOn, protocol.duration_days);

  const { error } = await sb.from('protocol_assignments').insert({
    company_id: ctx.companyId,
    protocol_id: protocolId,
    contact_id: contactId,
    // Snapshotted from the contact so the member surface, when it ships, needs no second join. Null
    // is normal: most of the 270 migrated clients have no app account yet.
    profile_id: contact.profile_id,
    locale,
    sent_on: sentOn,
    ends_on: endsOn,
    status: 'active',
    assigned_by: ctx.userId,
  });
  if (error) {
    if (isDuplicate((error as { code?: string }).code)) return { ok: false, error: 'duplicate' };
    console.error('assignProtocolAction insert:', error.message);
    return { ok: false, error: 'failed' };
  }

  revalidatePath('/coach/tool/protocols');
  revalidatePath(`/coach/tool/protocols/${protocolId}`);
  return { ok: true, endsOn };
}

const StatusInput = z.object({
  assignmentId: z.string().uuid(),
  status: z.enum(['active', 'completed', 'cancelled']),
});

/**
 * Move an assignment between active / completed / cancelled.
 *
 * completed_on is set and cleared here rather than left to the caller, because the table CHECKs that
 * the two agree. Letting a caller pass its own date is how a "completed" row with a null date, or an
 * active row carrying a stale completion date, gets written.
 */
export async function setAssignmentStatusAction(input: unknown): Promise<ProtocolActionResult> {
  const parsed = StatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const timezone = await getProfileTimezone(ctx.userId);
  const today = localDay(timezone);

  const { data, error } = await createServiceClient()
    .from('protocol_assignments')
    .update({
      status: parsed.data.status,
      completed_on: parsed.data.status === 'completed' ? today : null,
    })
    .eq('id', parsed.data.assignmentId)
    .eq('company_id', ctx.companyId)
    .select('protocol_id')
    .maybeSingle();
  if (error) {
    console.error('setAssignmentStatusAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  const row = data as { protocol_id: string } | null;
  if (!row) return { ok: false, error: 'not_found' };

  revalidatePath('/coach/tool/protocols');
  revalidatePath(`/coach/tool/protocols/${row.protocol_id}`);
  return { ok: true };
}

const PlanDeliveredInput = z.object({
  assignmentId: z.string().uuid(),
  isDelivered: z.boolean(),
});

/**
 * Record that step two landed: the personalised meal plan has been delivered to this client.
 *
 * Clearing it is supported because "marked the wrong row" is a real thing at 9pm, and a wrong tick
 * here silently removes a client from the overdue list, which is the one list nobody is watching.
 */
export async function setPlanDeliveredAction(input: unknown): Promise<ProtocolActionResult> {
  const parsed = PlanDeliveredInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const timezone = await getProfileTimezone(ctx.userId);
  const today = localDay(timezone);

  const { data, error } = await createServiceClient()
    .from('protocol_assignments')
    .update({ plan_delivered_on: parsed.data.isDelivered ? today : null })
    .eq('id', parsed.data.assignmentId)
    .eq('company_id', ctx.companyId)
    .select('protocol_id')
    .maybeSingle();
  if (error) {
    console.error('setPlanDeliveredAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  const row = data as { protocol_id: string } | null;
  if (!row) return { ok: false, error: 'not_found' };

  revalidatePath('/coach/tool/protocols');
  revalidatePath(`/coach/tool/protocols/${row.protocol_id}`);
  return { ok: true };
}

const SpanishInput = z.object({
  protocolId: z.string().uuid(),
  esStatus: z.enum(['missing', 'draft', 'approved']),
});

/**
 * Approve (or unapprove) the Spanish copy.
 *
 * requireApprover, not requireCoach: this is the switch that lets a Spanish-first member be sent
 * words written in Stephanie's name. An assistant may draft; only the coach or the operator signs.
 */
export async function setProtocolSpanishStatusAction(input: unknown): Promise<ProtocolActionResult> {
  const parsed = SpanishInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireApprover();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const { data, error } = await createServiceClient()
    .from('protocols')
    .update({ es_status: parsed.data.esStatus })
    .eq('id', parsed.data.protocolId)
    .eq('company_id', ctx.companyId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('setProtocolSpanishStatusAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  if (!data) return { ok: false, error: 'not_found' };

  revalidatePath('/coach/tool/protocols');
  revalidatePath(`/coach/tool/protocols/${parsed.data.protocolId}`);
  return { ok: true };
}
