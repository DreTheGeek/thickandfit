// Coach client-profile engagement reads (Lenus parity): the membership overview (period / type /
// status / payment) and the assigned habits + streak. Reads via the service client; the requireCoach
// page authorizes companyId + the contact/profile first. Graceful for app-native, comped, and legacy
// (Lenus-imported client_subscriptions) members alike.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { localToday } from '@/lib/nutrition/diary';

export type PaymentLabel = 'free' | 'paid' | 'past_due' | 'comped';
export type MembershipInfo = {
  productType: string | null;
  status: string | null;
  payment: PaymentLabel;
  startedAt: string | null;
  endedAt: string | null;
  nextBillingDate: string | null;
  priceCents: number | null;
  currency: string;
  autoRenew: boolean | null;
};

export type HabitLite = { id: string; title: string; icon: string | null; doneToday: boolean; pct7: number };
export type ClientHabits = { habits: HabitLite[]; streak: { current: number; longest: number } | null };

type ProfileBits = { role: string; compUntil: string | null; createdAt: string };
type SubRow = {
  status: string | null;
  product_type: string | null;
  started_at: string | null;
  ended_at: string | null;
  next_billing_date: string | null;
  grandfathered_price_cents: number | null;
  currency: string | null;
  is_auto_renew: boolean | null;
};

export async function getClientMembership(contactId: string | null, profile: ProfileBits): Promise<MembershipInfo> {
  const sb = createServiceClient();
  let sub: SubRow | null = null;
  if (contactId) {
    const { data } = await sb
      .from('client_subscriptions')
      .select('status, product_type, started_at, ended_at, next_billing_date, grandfathered_price_cents, currency, is_auto_renew')
      .eq('contact_id', contactId)
      .maybeSingle();
    sub = (data as SubRow | null) ?? null;
  }

  const compActive = Boolean(profile.compUntil && new Date(profile.compUntil).getTime() > new Date().getTime());
  const price = sub?.grandfathered_price_cents ?? null;

  let payment: PaymentLabel;
  if (sub?.status === 'past_due' || sub?.status === 'unpaid') payment = 'past_due';
  else if (sub?.status === 'active' && price && price > 0) payment = 'paid';
  else if (compActive || profile.role === 'free') payment = 'comped';
  else payment = 'free';

  return {
    productType: sub?.product_type ?? null,
    status: sub?.status ?? (compActive ? 'comped' : profile.role === 'free' ? 'free' : 'active'),
    payment,
    startedAt: sub?.started_at ?? profile.createdAt,
    endedAt: sub?.ended_at ?? (compActive ? profile.compUntil : null),
    nextBillingDate: sub?.next_billing_date ?? null,
    priceCents: price,
    currency: sub?.currency ?? 'USD',
    autoRenew: sub?.is_auto_renew ?? null,
  };
}

export async function getClientHabits(profileId: string, tz: string): Promise<ClientHabits> {
  const sb = createServiceClient();
  const today = localToday(tz);
  const weekAgo = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 6);
    return d.toISOString().slice(0, 10);
  })();

  const [{ data: habitsRaw }, { data: streakRaw }] = await Promise.all([
    sb.from('habits').select('id, title, icon, sort_order').eq('profile_id', profileId).eq('is_active', true).order('sort_order', { ascending: true }),
    sb.from('user_streaks').select('current_streak, longest_streak').eq('profile_id', profileId).maybeSingle(),
  ]);
  const habitRows = (habitsRaw ?? []) as { id: string; title: string; icon: string | null }[];
  if (habitRows.length === 0) {
    const s = streakRaw as { current_streak: number; longest_streak: number } | null;
    return { habits: [], streak: s ? { current: s.current_streak, longest: s.longest_streak } : null };
  }

  const ids = habitRows.map((h) => h.id);
  const { data: logs } = await sb
    .from('habit_logs')
    .select('habit_id, logged_date, done')
    .in('habit_id', ids)
    .gte('logged_date', weekAgo)
    .eq('done', true);
  const doneByHabit: Record<string, Set<string>> = {};
  for (const l of (logs ?? []) as { habit_id: string; logged_date: string }[]) {
    (doneByHabit[l.habit_id] ??= new Set()).add(l.logged_date);
  }

  const habits: HabitLite[] = habitRows.map((h) => {
    const done = doneByHabit[h.id] ?? new Set<string>();
    return { id: h.id, title: h.title, icon: h.icon, doneToday: done.has(today), pct7: Math.round((done.size / 7) * 100) };
  });
  const s = streakRaw as { current_streak: number; longest_streak: number } | null;
  return { habits, streak: s ? { current: s.current_streak, longest: s.longest_streak } : null };
}
