// "Someone just signed up", with enough detail to act on without opening the app.
//
// WHY THIS DID NOT EXIST. The bot alerted on support tickets and sent a 9pm digest, and that was the
// whole list. A signup, the single event this business is being built to produce, went unannounced
// until the recap that night.
//
// FIRED FROM A DATABASE TRIGGER, not from the signup code path. There are four ways a profile can be
// born (email signup, Google, an admin invite, a direct insert) and wiring the notification into one
// of them is how the next one arrives silently. The row appearing in `profiles` is the one thing
// every path has in common. It also means a signup still announces itself when the app's host is
// down, which is the condition under which you most want to know people are still arriving.
//
// WHAT IT REPORTS, and the rule that shapes it: every section is looked up live, so this reads
// correctly whether it fires the instant the account is created (no plan, no goal, no onboarding) or
// is replayed later for an established member. Sections with nothing to say are dropped, with ONE
// exception: money. "No payment on file" is printed explicitly, because a blank where the plan
// should be reads as "I do not know" when the answer is a definite "she has not paid yet", and that
// is the question this alert exists to answer.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { esc, reply, APP_URL } from './telegram.ts';

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  company_id: string | null;
  ui_locale: string | null;
  content_locale: string | null;
  timezone: string | null;
  is_legacy_client: boolean | null;
  created_at: string | null;
};

const LANG: Record<string, string> = { en: 'English', es: 'Spanish' };

/**
 * POUNDS FIRST, kg underneath.
 *
 * The app stores kg because the maths is done in kg, but the audience is women in the US and LATAM
 * and the coach reading this alert thinks in pounds. "Target 88 kg" is a number she has to convert
 * before it means anything, at the exact moment she is trying to size someone up at a glance.
 */
function lb(kg: number): string {
  return `${Math.round(kg * 2.20462)} lb`;
}
function kgLine(kg: number): string {
  return `${Math.round(kg * 10) / 10} kg`;
}
function height(cm: number): string {
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
}
/** slug -> readable. "lower_back" in a chat message is a database leaking into a person's day. */
function label(slug: string): string {
  return String(slug ?? '').replace(/_/g, ' ').trim();
}
/** 2282297379 -> (228) 229-7379. Anything that is not a 10-digit US number is left alone. */
function phoneFmt(raw: string): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith('1')) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function money(cents: number | null | undefined, currency: string | null | undefined): string {
  const v = Number(cents ?? 0) / 100;
  const cur = (currency ?? 'usd').toUpperCase();
  const symbol = cur === 'USD' ? '$' : `${cur} `;
  return `${symbol}${v.toFixed(2)}`;
}

/** Joined at, in the member's OWN timezone: "3:06 PM, Aug 3" means more than a UTC instant. */
function joinedAt(iso: string | null, tz: string | null): string {
  if (!iso) return 'just now';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'America/New_York',
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

export async function sendSignupAlert(svc: SupabaseClient, profileId: string): Promise<boolean> {
  const { data } = await svc
    .from('profiles')
    .select('id, email, full_name, role, company_id, ui_locale, content_locale, timezone, is_legacy_client, created_at')
    .eq('id', profileId)
    .maybeSingle();
  const p = data as ProfileRow | null;
  if (!p) return false;

  const companyId = p.company_id ?? '';
  const email = (p.email ?? '').trim();

  // Everything else in parallel. All of it is optional by design: a brand-new account has none of it,
  // and each lookup resolves to null rather than throwing so one missing table cannot cost the alert.
  const [providers, sub, ent, lead, contact, onboarding, todayCount] = await Promise.all([
    svc.rpc('auth_providers_for', { p_user: p.id }).then((r) => (r.data as string[] | null) ?? []).catch(() => []),
    svc.from('subscriptions').select('status, price_cents, currency, trial_end, current_period_end, cancel_at_period_end')
      .eq('profile_id', p.id).order('created_at', { ascending: false }).limit(1)
      .then((r) => (r.data ?? [])[0] ?? null).catch(() => null),
    svc.from('entitlements').select('product_key, status, source, expires_at')
      .eq('profile_id', p.id).order('created_at', { ascending: false }).limit(1)
      .then((r) => (r.data ?? [])[0] ?? null).catch(() => null),
    email
      ? svc.from('waitlist_leads').select('source, referred_by_code, referral_code, entry_count, phone, confirmed_at')
          .eq('company_id', companyId).ilike('email', email).limit(1)
          .then((r) => (r.data ?? [])[0] ?? null).catch(() => null)
      : Promise.resolve(null),
    svc.from('contacts').select('id, product_type, owner, phone, is_legacy')
      .eq('profile_id', p.id).limit(1).then((r) => (r.data ?? [])[0] ?? null).catch(() => null),
    svc.from('onboarding_responses').select('answers, computed_targets, goal_target_date, completed_at')
      .eq('profile_id', p.id).limit(1).then((r) => (r.data ?? [])[0] ?? null).catch(() => null),
    svc.from('profiles').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
      .then((r) => r.count ?? 0).catch(() => 0),
  ]);

  // A name is not guaranteed: an admin-created account carries no signup metadata, so say so rather
  // than printing an empty line that reads like a rendering bug.
  const name = (p.full_name ?? '').trim() || 'No name yet';
  const isStaff = p.role !== 'subscriber' && p.role !== 'free';
  const phone = (lead?.phone ?? contact?.phone ?? '') as string;

  const L: string[] = [
    isStaff ? '👤 <b>NEW TEAM ACCOUNT</b>' : '🎉 <b>NEW SIGNUP</b>',
    '',
    `<b>${esc(name)}</b>`,
    esc(email || 'no email'),
  ];
  if (phone) L.push(esc(phoneFmt(phone)));

  if (!isStaff) {
    // --- money, always stated -------------------------------------------------------------------
    L.push('', '<b>PLAN</b>');
    if (sub) {
      const s = sub as { status: string; price_cents: number; currency: string; trial_end: string | null; current_period_end: string | null; cancel_at_period_end: boolean | null };
      L.push(`${esc(s.status)} · ${money(s.price_cents, s.currency)}`);
      if (s.trial_end) L.push(`Trial ends ${esc(s.trial_end.slice(0, 10))}`);
      if (s.current_period_end) L.push(`Renews ${esc(s.current_period_end.slice(0, 10))}`);
      if (s.cancel_at_period_end) L.push('⚠️ Set to cancel at period end');
    } else if (ent) {
      const e = ent as { product_key: string; status: string; source: string };
      L.push(`${esc(e.product_key)} · ${esc(e.status)} (${esc(e.source)})`);
      L.push('No card charged');
    } else {
      L.push(contact?.product_type ? `${esc(String(contact.product_type))} (selected)` : 'No plan selected');
      L.push('<i>No payment on file yet</i>');
    }

    // --- what she is actually here to do ----------------------------------------------------------
    if (onboarding) {
      const o = onboarding as {
        answers: Record<string, unknown> | null;
        computed_targets: Record<string, unknown> | null;
        goal_target_date: string | null;
      };
      const a = (o.answers ?? {}) as Record<string, unknown>;
      const t = (o.computed_targets ?? {}) as Record<string, unknown>;
      const m = (t.macros ?? {}) as { protein_g?: number; carbs_g?: number; fat_g?: number };

      // CURRENT and GOAL come from what she ANSWERED. The first version of this used
      // computed_targets.projectedKg, which is the projection at the end of the plan horizon, not
      // her target: it printed "Target 88 kg" for a member who WEIGHS 88 kg and is aiming for 79.
      // A number that is confidently wrong is worse than no number.
      const nowKg = Number(a.weightKg ?? 0);
      const goalKg = Number(a.goalWeightKg ?? 0);

      L.push('', '<b>GOAL</b>');
      if (nowKg && goalKg) {
        L.push(`${lb(nowKg)} → <b>${lb(goalKg)}</b>  (${lb(Math.abs(nowKg - goalKg))} to ${goalKg < nowKg ? 'lose' : 'gain'})`);
        L.push(`<i>${kgLine(nowKg)} → ${kgLine(goalKg)}</i>`);
      } else if (nowKg) {
        L.push(`Currently ${lb(nowKg)}, no goal weight set`);
      }
      const goals = Array.isArray(a.primaryGoals) ? (a.primaryGoals as string[]).map(label).join(', ') : '';
      if (goals) L.push(`Wants to: ${esc(goals)}`);
      if (Number(t.calories ?? 0)) {
        L.push(`${Number(t.calories)} kcal · ${m.protein_g ?? '?'}p / ${m.carbs_g ?? '?'}c / ${m.fat_g ?? '?'}f`);
      }
      if (o.goal_target_date) L.push(`By ${esc(o.goal_target_date.slice(0, 10))}`);

      // --- SAFETY, and it sits right under the goal for a reason ---------------------------------
      // A coach writing her first program needs to know about a bad lower back BEFORE she opens the
      // builder, not after. This is the one section worth interrupting someone for.
      const h = (a.health ?? {}) as {
        injuries?: string[]; conditions?: string[]; safety?: string[]; pregnancy?: string;
        trainingLocation?: string; trainingExperience?: string;
      };
      const flags: string[] = [];
      if (h.injuries?.length) flags.push(`Injuries: ${h.injuries.map(label).join(', ')}`);
      if (h.conditions?.length) flags.push(`Conditions: ${h.conditions.map(label).join(', ')}`);
      if (h.safety?.length) flags.push(`Safety: ${h.safety.map(label).join(', ')}`);
      if (h.pregnancy && h.pregnancy !== 'none') flags.push(`Pregnancy: ${label(h.pregnancy)}`);
      if (flags.length) {
        L.push('', '⚠️ <b>HEALTH</b>');
        for (const f of flags) L.push(esc(f));
      }

      const ctx: string[] = [];
      if (Number(a.age ?? 0)) ctx.push(`${Number(a.age)}y`);
      if (a.sex) ctx.push(label(String(a.sex)));
      if (Number(a.heightCm ?? 0)) ctx.push(height(Number(a.heightCm)));
      if (h.trainingExperience) ctx.push(`${label(h.trainingExperience)} experience`);
      if (h.trainingLocation) ctx.push(`trains ${label(h.trainingLocation)}`);
      if (ctx.length) L.push('', esc(ctx.join(' · ')));
    } else {
      L.push('', '<b>GOAL</b>', '<i>Has not finished onboarding</i>');
    }

    // --- where she came from ------------------------------------------------------------------
    L.push('', '<b>ORIGIN</b>');
    if (lead) {
      const l = lead as { source: string | null; referred_by_code: string | null; entry_count: number | null; confirmed_at: string | null };
      L.push(`Waitlist${l.source ? ` (${esc(l.source)})` : ''}${l.confirmed_at ? ', confirmed' : ', never confirmed'}`);
      if (l.referred_by_code) L.push(`Referred by <code>${esc(l.referred_by_code)}</code>`);
      if (l.entry_count) L.push(`${l.entry_count} giveaway entries`);
    } else {
      L.push('Direct signup, not from the waitlist');
    }
    // A returning Lenus client is a materially different conversation from a stranger.
    if (p.is_legacy_client || contact?.is_legacy) L.push('⭐ <b>Returning client</b> (claimed her Lenus history)');
    if (contact?.owner) L.push(`Coach: ${esc(String(contact.owner))}`);
  }

  // --- account mechanics ------------------------------------------------------------------------
  L.push('', '<b>ACCOUNT</b>');
  L.push(`Signed up with ${esc(providers.length ? providers.join(' + ') : 'email')}`);
  L.push(`Role: ${esc(p.role ?? 'subscriber')}`);
  const lang = p.content_locale ?? p.ui_locale ?? 'en';
  L.push(`Language: ${esc(LANG[lang] ?? lang)}`);
  if (p.timezone) L.push(`Timezone: ${esc(p.timezone)}`);
  L.push(`Joined ${esc(joinedAt(p.created_at, p.timezone))}`);

  if (!isStaff) {
    L.push('', todayCount > 1 ? `<b>${todayCount} signups in the last 24h.</b>` : 'First signup in the last 24h.');
    // Straight to HER record when one exists. Landing on the full client list means finding her
    // again by hand, which is the friction this alert is supposed to remove.
    const cid = (contact as { id?: string } | null)?.id;
    L.push('', cid ? `${APP_URL}/coach/clients/${cid}` : `${APP_URL}/coach/clients`);
  } else {
    L.push('', `${APP_URL}/admin/team`);
  }

  return await reply(L.join('\n'));
}
