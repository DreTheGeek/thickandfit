// The publish dispatcher (PRD-30, WP8). This is the ONLY place that writes the real client-facing row
// (a messages or meal_plans row) for an approved draft. It is server-only, unexported to any client,
// and the ONLY caller is decide() in approval-actions.ts (which is guarded by requireApprover). An
// assistant_coach can never reach this code: requireApprover redirects them before decide() runs.
//
// ID-SPACE PITFALL (highest data risk): messages.client_id references profiles(id) but
// meal_plans.contact_id references contacts(id). They are DIFFERENT id spaces. The queue row's
// client_id is always a profiles(id). For meal_plan drafts the contacts(id) target is carried
// SEPARATELY as payload.contactId. Do NOT assume client_id == contactId.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type PublishItem = {
  itemType: string;
  clientId: string; // profiles(id) - the subscriber the draft is for
  draftedBy: string; // profiles(id) - the assistant who authored it
  payload: Record<string, unknown>;
};

export type PublishResult = { ok: boolean; error?: string; itemRef?: string };

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function asIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// Publish an approved message: insert the real messages row into the client's thread. sender_id is the
// drafter (the assistant authored it; "approved by Stephanie" is surfaced only in coach views). The
// service client bypasses messages_rw RLS (which wants sender_id = auth.uid()), which is correct here.
async function publishMessage(companyId: string, item: PublishItem): Promise<PublishResult> {
  const body = asString(item.payload.body);
  if (!body) return { ok: false, error: 'empty_message' };
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('messages')
    .insert({
      company_id: companyId,
      client_id: item.clientId, // profiles(id): the thread owner
      sender_id: item.draftedBy, // byline: the assistant who drafted it
      body,
    })
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, itemRef: data?.id };
}

// Publish an approved meal plan: insert the real meal_plans row. The target is a contacts(id) carried
// in payload.contactId (NOT the queue's client_id, which is a profiles id). Macro columns are optional;
// the generated protein/carb/fat columns derive from calorie_goal + the split percentages (0019).
async function publishMealPlan(companyId: string, item: PublishItem): Promise<PublishResult> {
  const p = item.payload;
  const contactId = asString(p.contactId);
  if (!contactId) return { ok: false, error: 'missing_contact' }; // ID-space: contacts(id), not client_id
  const name = asString(p.name) || 'Plan';
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('meal_plans')
    .insert({
      company_id: companyId,
      contact_id: contactId, // contacts(id) target, explicitly carried in the payload
      name,
      calorie_goal: asIntOrNull(p.calorieGoal),
      split_protein_pct: asIntOrNull(p.proteinPct),
      split_carb_pct: asIntOrNull(p.carbPct),
      split_fat_pct: asIntOrNull(p.fatPct),
      macro_timing_name: asString(p.macroTiming) || null,
      plan_jsonb: p.plan ?? null,
    })
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, itemRef: data?.id };
}

export async function publishApprovedItem(companyId: string, item: PublishItem): Promise<PublishResult> {
  switch (item.itemType) {
    case 'message':
      return publishMessage(companyId, item);
    case 'meal_plan':
      return publishMealPlan(companyId, item);
    default:
      return { ok: false, error: 'unknown_item_type' };
  }
}
