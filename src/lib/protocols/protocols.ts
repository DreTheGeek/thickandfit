// Server reads for protocols and their assignments.
//
// Service client (server-only), matching the rest of the coach surface: company_id is pinned by the
// caller from the auth context, never from searchParams. RLS on these tables is coach-scoped, and the
// service client bypasses it, so the explicit .eq('company_id', ...) on every query IS the tenant
// boundary here. Removing one is a cross-tenant leak, not a missing filter.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import {
  daysBetween,
  groupGrocery,
  sumMeals,
  type ProtocolAssignmentRow,
  type ProtocolAssignmentStatus,
  type ProtocolClientOption,
  type ProtocolDetail,
  type ProtocolDrinkItem,
  type ProtocolEsStatus,
  type ProtocolGroceryGroup,
  type ProtocolLocale,
  type ProtocolMeal,
  type ProtocolRule,
  type ProtocolSummary,
} from '@/lib/protocols/types';

type ProtocolRaw = {
  id: string;
  slug: string;
  name_en: string;
  name_es: string | null;
  purpose_en: string;
  purpose_es: string | null;
  duration_days: number;
  stated_kcal_text: string;
  stated_protein_g: number;
  stated_carb_g: number;
  stated_fat_g: number;
  fasted_drink_title_en: string | null;
  fasted_drink_title_es: string | null;
  fasted_drink_note_en: string | null;
  fasted_drink_note_es: string | null;
  es_status: string;
  is_published: boolean;
};

const PROTOCOL_COLUMNS =
  'id, slug, name_en, name_es, purpose_en, purpose_es, duration_days, stated_kcal_text, ' +
  'stated_protein_g, stated_carb_g, stated_fat_g, fasted_drink_title_en, fasted_drink_title_es, ' +
  'fasted_drink_note_en, fasted_drink_note_es, es_status, is_published';

function esStatusOf(raw: string): ProtocolEsStatus {
  return raw === 'draft' || raw === 'approved' ? raw : 'missing';
}

async function loadMeals(companyId: string, protocolId: string): Promise<ProtocolMeal[]> {
  const sb = createServiceClient();
  const { data: mealRows, error } = await sb
    .from('protocol_meals')
    .select('id, sequence, name_en, name_es, kcal, protein_g, carb_g, fat_g')
    .eq('company_id', companyId)
    .eq('protocol_id', protocolId)
    .order('sequence', { ascending: true });
  if (error) {
    console.error('loadMeals:', error.message);
    return [];
  }
  const meals = (mealRows ?? []) as {
    id: string;
    sequence: number;
    name_en: string;
    name_es: string | null;
    kcal: number;
    protein_g: number;
    carb_g: number;
    fat_g: number;
  }[];
  if (meals.length === 0) return [];

  const { data: itemRows, error: itemError } = await sb
    .from('protocol_meal_items')
    .select('meal_id, sequence, text_en, text_es')
    .eq('company_id', companyId)
    .in(
      'meal_id',
      meals.map((m) => m.id),
    )
    .order('sequence', { ascending: true });
  if (itemError) console.error('loadMeals items:', itemError.message);
  const items = (itemRows ?? []) as {
    meal_id: string;
    sequence: number;
    text_en: string;
    text_es: string | null;
  }[];

  return meals.map((m) => ({
    id: m.id,
    sequence: m.sequence,
    nameEn: m.name_en,
    nameEs: m.name_es,
    kcal: m.kcal,
    proteinG: m.protein_g,
    carbG: m.carb_g,
    fatG: m.fat_g,
    items: items
      .filter((i) => i.meal_id === m.id)
      .map((i) => ({ sequence: i.sequence, textEn: i.text_en, textEs: i.text_es })),
  }));
}

/**
 * Per-protocol assignment counts: how many clients are on it, and how many are owed their
 * personalised plan. Two aggregates in one pass so the list page does not fan out per row.
 */
async function assignmentCounts(
  companyId: string,
  todayIso: string,
): Promise<Map<string, { active: number; planDue: number }>> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('protocol_assignments')
    .select('protocol_id, status, ends_on, plan_delivered_on')
    .eq('company_id', companyId)
    .limit(5000);
  if (error) {
    console.error('assignmentCounts:', error.message);
    return new Map();
  }
  const rows = (data ?? []) as {
    protocol_id: string;
    status: string;
    ends_on: string;
    plan_delivered_on: string | null;
  }[];
  const out = new Map<string, { active: number; planDue: number }>();
  for (const r of rows) {
    const e = out.get(r.protocol_id) ?? { active: 0, planDue: 0 };
    if (r.status === 'active') e.active += 1;
    // Cancelled runs are not owed a plan. Completed ones still are, until one is recorded.
    if (r.status !== 'cancelled' && r.plan_delivered_on === null && r.ends_on < todayIso) e.planDue += 1;
    out.set(r.protocol_id, e);
  }
  return out;
}

/** Every protocol in the tenant, with its derived day total and its assignment counts. */
export async function listProtocols(companyId: string, todayIso: string): Promise<ProtocolSummary[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('protocols')
    .select(PROTOCOL_COLUMNS)
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    console.error('listProtocols:', error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as ProtocolRaw[];
  if (rows.length === 0) return [];

  const counts = await assignmentCounts(companyId, todayIso);
  const summaries: ProtocolSummary[] = [];
  for (const p of rows) {
    const meals = await loadMeals(companyId, p.id);
    const { count: ruleCount } = await sb
      .from('protocol_rules')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('protocol_id', p.id);
    const c = counts.get(p.id) ?? { active: 0, planDue: 0 };
    summaries.push({
      id: p.id,
      slug: p.slug,
      nameEn: p.name_en,
      nameEs: p.name_es,
      purposeEn: p.purpose_en,
      purposeEs: p.purpose_es,
      durationDays: p.duration_days,
      stated: {
        kcalText: p.stated_kcal_text,
        proteinG: p.stated_protein_g,
        carbG: p.stated_carb_g,
        fatG: p.stated_fat_g,
      },
      esStatus: esStatusOf(p.es_status),
      isPublished: p.is_published,
      ruleCount: ruleCount ?? 0,
      mealCount: meals.length,
      summed: sumMeals(meals),
      activeAssignments: c.active,
      planDueCount: c.planDue,
    });
  }
  return summaries;
}

/** One protocol, fully expanded: rules, fasted drink, the day, and the grocery list. */
export async function getProtocolDetail(
  companyId: string,
  protocolId: string,
  todayIso: string,
): Promise<ProtocolDetail | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('protocols')
    .select(PROTOCOL_COLUMNS)
    .eq('company_id', companyId)
    .eq('id', protocolId)
    .maybeSingle();
  if (error) {
    console.error('getProtocolDetail:', error.message);
    return null;
  }
  const p = data as unknown as ProtocolRaw | null;
  if (!p) return null;

  const [rulesRes, drinkRes, groceryRes, meals, counts] = await Promise.all([
    sb
      .from('protocol_rules')
      .select('sequence, text_en, text_es')
      .eq('company_id', companyId)
      .eq('protocol_id', p.id)
      .order('sequence', { ascending: true }),
    sb
      .from('protocol_drink_items')
      .select('sequence, item_en, item_es, amount_en, amount_es')
      .eq('company_id', companyId)
      .eq('protocol_id', p.id)
      .order('sequence', { ascending: true }),
    sb
      .from('protocol_grocery_items')
      .select('sequence, category_en, category_es, item_en, item_es, quantity_en, quantity_es')
      .eq('company_id', companyId)
      .eq('protocol_id', p.id)
      .order('sequence', { ascending: true }),
    loadMeals(companyId, p.id),
    assignmentCounts(companyId, todayIso),
  ]);

  const rules: ProtocolRule[] = ((rulesRes.data ?? []) as {
    sequence: number;
    text_en: string;
    text_es: string | null;
  }[]).map((r) => ({ sequence: r.sequence, textEn: r.text_en, textEs: r.text_es }));

  const drink: ProtocolDrinkItem[] = ((drinkRes.data ?? []) as {
    sequence: number;
    item_en: string;
    item_es: string | null;
    amount_en: string;
    amount_es: string | null;
  }[]).map((d) => ({
    sequence: d.sequence,
    itemEn: d.item_en,
    itemEs: d.item_es,
    amountEn: d.amount_en,
    amountEs: d.amount_es,
  }));

  const grocery: ProtocolGroceryGroup[] = groupGrocery(
    ((groceryRes.data ?? []) as {
      sequence: number;
      category_en: string;
      category_es: string | null;
      item_en: string;
      item_es: string | null;
      quantity_en: string | null;
      quantity_es: string | null;
    }[]).map((g) => ({
      sequence: g.sequence,
      categoryEn: g.category_en,
      categoryEs: g.category_es,
      itemEn: g.item_en,
      itemEs: g.item_es,
      quantityEn: g.quantity_en,
      quantityEs: g.quantity_es,
    })),
  );

  const c = counts.get(p.id) ?? { active: 0, planDue: 0 };
  return {
    id: p.id,
    slug: p.slug,
    nameEn: p.name_en,
    nameEs: p.name_es,
    purposeEn: p.purpose_en,
    purposeEs: p.purpose_es,
    durationDays: p.duration_days,
    stated: {
      kcalText: p.stated_kcal_text,
      proteinG: p.stated_protein_g,
      carbG: p.stated_carb_g,
      fatG: p.stated_fat_g,
    },
    esStatus: esStatusOf(p.es_status),
    isPublished: p.is_published,
    ruleCount: rules.length,
    mealCount: meals.length,
    summed: sumMeals(meals),
    activeAssignments: c.active,
    planDueCount: c.planDue,
    fastedDrinkTitleEn: p.fasted_drink_title_en,
    fastedDrinkTitleEs: p.fasted_drink_title_es,
    fastedDrinkNoteEn: p.fasted_drink_note_en,
    fastedDrinkNoteEs: p.fasted_drink_note_es,
    rules,
    drink,
    meals,
    grocery,
  };
}

type AssignmentRaw = {
  id: string;
  protocol_id: string;
  contact_id: string;
  profile_id: string | null;
  locale: string;
  sent_on: string;
  ends_on: string;
  status: string;
  completed_on: string | null;
  plan_delivered_on: string | null;
  notes: string | null;
};

function statusOf(raw: string): ProtocolAssignmentStatus {
  return raw === 'completed' || raw === 'cancelled' ? raw : 'active';
}

function contactName(c: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}): string {
  const full = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return full || c.email || 'Unknown';
}

async function hydrate(
  companyId: string,
  rows: AssignmentRaw[],
  todayIso: string,
): Promise<ProtocolAssignmentRow[]> {
  if (rows.length === 0) return [];
  const sb = createServiceClient();
  const [contactsRes, protocolsRes] = await Promise.all([
    sb
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('company_id', companyId)
      .in('id', [...new Set(rows.map((r) => r.contact_id))]),
    sb
      .from('protocols')
      .select('id, name_en')
      .eq('company_id', companyId)
      .in('id', [...new Set(rows.map((r) => r.protocol_id))]),
  ]);
  const names = new Map(
    ((contactsRes.data ?? []) as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }[]).map((c) => [c.id, contactName(c)]),
  );
  const protocolNames = new Map(
    ((protocolsRes.data ?? []) as { id: string; name_en: string }[]).map((p) => [p.id, p.name_en]),
  );

  return rows.map((r) => {
    const status = statusOf(r.status);
    return {
      id: r.id,
      protocolId: r.protocol_id,
      protocolName: protocolNames.get(r.protocol_id) ?? 'Protocol',
      contactId: r.contact_id,
      contactName: names.get(r.contact_id) ?? 'Unknown',
      profileId: r.profile_id,
      locale: (r.locale === 'es' ? 'es' : 'en') as ProtocolLocale,
      sentOn: r.sent_on,
      endsOn: r.ends_on,
      status,
      completedOn: r.completed_on,
      planDeliveredOn: r.plan_delivered_on,
      notes: r.notes,
      daysRemaining: daysBetween(todayIso, r.ends_on),
      isPlanDue: status !== 'cancelled' && r.plan_delivered_on === null && r.ends_on < todayIso,
    };
  });
}

/** The roster for one protocol, newest send first. */
export async function listAssignmentsForProtocol(
  companyId: string,
  protocolId: string,
  todayIso: string,
): Promise<ProtocolAssignmentRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('protocol_assignments')
    .select('id, protocol_id, contact_id, profile_id, locale, sent_on, ends_on, status, completed_on, plan_delivered_on, notes')
    .eq('company_id', companyId)
    .eq('protocol_id', protocolId)
    .order('sent_on', { ascending: false })
    .limit(1000);
  if (error) {
    console.error('listAssignmentsForProtocol:', error.message);
    return [];
  }
  return hydrate(companyId, (data ?? []) as AssignmentRaw[], todayIso);
}

/**
 * Everyone whose protocol window has closed with no personalised plan recorded.
 *
 * This is the query the table was built for: "the 14 days ended and nobody built her plan" is the
 * failure it replaces. Oldest end date first, so the longest-waiting client is at the top.
 */
export async function listPlanDue(companyId: string, todayIso: string): Promise<ProtocolAssignmentRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('protocol_assignments')
    .select('id, protocol_id, contact_id, profile_id, locale, sent_on, ends_on, status, completed_on, plan_delivered_on, notes')
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .is('plan_delivered_on', null)
    .lt('ends_on', todayIso)
    .order('ends_on', { ascending: true })
    .limit(500);
  if (error) {
    console.error('listPlanDue:', error.message);
    return [];
  }
  return hydrate(companyId, (data ?? []) as AssignmentRaw[], todayIso);
}

/**
 * The clients this protocol can be sent to.
 *
 * CRM contacts, not profiles: the contact is the coach's unit of "a client" (270 of them today
 * against 14 profiles pre-launch), and it is the same id space meal_plans targets. Contacts already
 * on this protocol are excluded here as well as blocked by a partial unique index, so the picker
 * never offers an option that the action will reject.
 */
export async function listAssignableClients(
  companyId: string,
  protocolId: string,
): Promise<ProtocolClientOption[]> {
  const sb = createServiceClient();
  const [contactsRes, activeRes] = await Promise.all([
    sb
      .from('contacts')
      .select('id, first_name, last_name, email, language, profile_id')
      .eq('company_id', companyId)
      .eq('type', 'client')
      .order('first_name', { ascending: true })
      .limit(1000),
    sb
      .from('protocol_assignments')
      .select('contact_id')
      .eq('company_id', companyId)
      .eq('protocol_id', protocolId)
      .eq('status', 'active')
      .limit(2000),
  ]);
  const taken = new Set(
    ((activeRes.data ?? []) as { contact_id: string }[]).map((a) => a.contact_id),
  );
  const rows = (contactsRes.data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    language: string | null;
    profile_id: string | null;
  }[];
  return rows
    .filter((c) => !taken.has(c.id))
    .map<ProtocolClientOption>((c) => ({
      contactId: c.id,
      name: contactName(c),
      language: c.language === 'es' ? 'es' : c.language === 'en' ? 'en' : null,
      profileId: c.profile_id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
