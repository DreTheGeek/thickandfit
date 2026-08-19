// Scheduled notification GENERATORS. The delivery layer (in-app insert + best-effort push, both
// bilingual) already exists; this is the missing piece that INSERTS notification rows on a schedule.
// Each generator selects its recipients via the service client and fans out through the existing
// createNotificationsBulk path so copy is per-recipient localized and push fires when keyed.
//
// Called by the secret-gated /api/internal/notify-* routes, which pg_cron triggers via net.http_post.
// Every generator is best-effort and returns a structured result the endpoint logs to cron_job_log.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { createNotificationsBulk } from '@/lib/notifications/create';
import { asNotifLocale, notifText, type NotifLocale } from '@/lib/notifications/i18n';
import { localHour, localWeekday } from '@/lib/datetime/local-day';
import { readCoachSettings } from '@/lib/coach/settings';
import {
  checkinCadenceDays,
  isCheckinDue,
  reminderHourOf,
  type CoachSettings,
} from '@/lib/coach/settings-shared';
import { recomputeChallengeBoard } from '@/lib/community/challenge-progress';
import { notifyNewChallenge } from '@/lib/notifications/triggers';
import { getEngagementSweep } from '@/lib/engagement/risk';
import { listExpiringPlans } from '@/lib/coach/plan-followups';
import {
  activeCampaigns,
  campaignHistoryKey,
  isCampaignAudience,
  seasonYear,
  selectCampaignRecipients,
} from '@/lib/campaigns/season-shared';
import type { CampaignMember, CampaignRow } from '@/lib/campaigns/season-shared';
import {
  LIFECYCLE_COPY_KEY,
  LIFECYCLE_LINK,
  LIFECYCLE_TYPES,
  LIFECYCLE_TYPE_LIST,
  lifecycleHistoryKey,
  lifecycleStage,
  selectLifecycleSends,
} from '@/lib/engagement/lifecycle-shared';
import type { LifecycleCandidate } from '@/lib/engagement/lifecycle-shared';
import {
  isEngagementRisk,
  ladderHistoryKey,
  ladderLookbackDay,
  reengageStage,
  selectLadderSends,
  REENGAGE_TYPES,
  REENGAGE_TYPE_LIST,
} from '@/lib/engagement/risk-shared';
import type { LadderCandidate } from '@/lib/engagement/risk-shared';
import type { NotificationPayload } from '@/lib/notifications/types';

export type GeneratorResult = {
  ok: boolean;
  job: string;
  selected: number;
  notified: number;
  error?: string;
};

// Active subscription statuses that still warrant a renewal nudge (mirrors billing ACTIVE_STATUSES).
const ACTIVE_SUB_STATUSES = ['trialing', 'active', 'past_due'];
// How many days ahead to nudge for renewals and comp expiry.
//
// 2 days, not 3, because Stephanie named the number on 2026-08-13: "hey, friendly reminder, your
// payment is gonna be due in the next 48 hours, make sure you have sufficient funds." Her declines
// are insufficient funds, not dead cards, so the window is the point — three days out is before
// payday for some of her book, and a reminder that arrives too early is a reminder that gets
// forgotten before it matters.
const RENEWAL_LEAD_DAYS = 2;
const COMP_LEAD_DAYS = 3;

/** Format an ISO/date string as a short localized date (e.g. "Jun 28" / "28 jun"). */
function shortDate(iso: string, locale: NotifLocale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(d);
}

// ---------------------------------------------------------------------------
// Renewal reminders: active subs renewing within RENEWAL_LEAD_DAYS, not set to cancel.
// ---------------------------------------------------------------------------
type RenewalRow = {
  profile_id: string;
  company_id: string;
  current_period_end: string | null;
  profiles: { ui_locale: string | null } | null;
};

export async function generateRenewalReminders(): Promise<GeneratorResult> {
  const svc = createServiceClient();
  const horizon = new Date(Date.now() + RENEWAL_LEAD_DAYS * 86_400_000).toISOString();
  const now = new Date().toISOString();

  const { data, error } = await svc
    .from('subscriptions')
    .select('profile_id, company_id, current_period_end, profiles!inner ( ui_locale )')
    .in('status', ACTIVE_SUB_STATUSES)
    .eq('cancel_at_period_end', false)
    .not('current_period_end', 'is', null)
    .gte('current_period_end', now)
    .lte('current_period_end', horizon);
  if (error) return { ok: false, job: 'renewals', selected: 0, notified: 0, error: error.message };

  const rows = ((data ?? []) as unknown as RenewalRow[]).filter((r) => r.current_period_end);
  if (rows.length === 0) return { ok: true, job: 'renewals', selected: 0, notified: 0 };

  // Fan out per company so the bulk insert stays tenant-scoped (createNotificationsBulk is per-company).
  const byCompany = new Map<string, Array<{ profileId: string; payload: NotificationPayload }>>();
  for (const r of rows) {
    const locale = asNotifLocale(r.profiles?.ui_locale);
    const date = shortDate(r.current_period_end as string, locale);
    const payload: NotificationPayload = {
      type: 'renewal',
      title: notifText(locale, 'renewalTitle'),
      body: notifText(locale, 'renewalBody', { date }),
      link: '/account/billing',
    };
    const list = byCompany.get(r.company_id) ?? [];
    list.push({ profileId: r.profile_id, payload });
    byCompany.set(r.company_id, list);
  }

  let notified = 0;
  for (const [companyId, recipients] of byCompany) {
    await createNotificationsBulk(companyId, recipients);
    notified += recipients.length;
  }
  return { ok: true, job: 'renewals', selected: rows.length, notified };
}

// ---------------------------------------------------------------------------
// Comp-expiry nudges: comp access ending within COMP_LEAD_DAYS. NOTIFY only; demotion is computed
// automatically by isEntitled() once comp_access_until passes, so nothing flips a role here.
// ---------------------------------------------------------------------------
type CompRow = {
  id: string;
  company_id: string;
  ui_locale: string | null;
  comp_access_until: string | null;
};

export async function generateCompExpiryReminders(): Promise<GeneratorResult> {
  const svc = createServiceClient();
  const now = new Date().toISOString();
  const horizon = new Date(Date.now() + COMP_LEAD_DAYS * 86_400_000).toISOString();

  const { data, error } = await svc
    .from('profiles')
    .select('id, company_id, ui_locale, comp_access_until')
    .not('comp_access_until', 'is', null)
    .gte('comp_access_until', now)
    .lte('comp_access_until', horizon);
  if (error) return { ok: false, job: 'comp-expiry', selected: 0, notified: 0, error: error.message };

  const rows = ((data ?? []) as CompRow[]).filter((r) => r.comp_access_until);
  if (rows.length === 0) return { ok: true, job: 'comp-expiry', selected: 0, notified: 0 };

  const byCompany = new Map<string, Array<{ profileId: string; payload: NotificationPayload }>>();
  for (const r of rows) {
    const locale = asNotifLocale(r.ui_locale);
    const date = shortDate(r.comp_access_until as string, locale);
    const payload: NotificationPayload = {
      type: 'comp_expiring',
      title: notifText(locale, 'compExpiringTitle'),
      body: notifText(locale, 'compExpiringBody', { date }),
      link: '/account/billing',
    };
    const list = byCompany.get(r.company_id) ?? [];
    list.push({ profileId: r.id, payload });
    byCompany.set(r.company_id, list);
  }

  let notified = 0;
  for (const [companyId, recipients] of byCompany) {
    await createNotificationsBulk(companyId, recipients);
    notified += recipients.length;
  }
  return { ok: true, job: 'comp-expiry', selected: rows.length, notified };
}

// ---------------------------------------------------------------------------
// Check-in due: published check-in forms, at the cadence the coach configured in coach_settings.
// ---------------------------------------------------------------------------
type AssignmentRow = {
  profile_id: string;
  company_id: string;
  form_id: string;
  forms: { title_en: string; title_es: string | null; type: string; status: string } | null;
  profiles: { ui_locale: string | null; timezone: string | null } | null;
};

// Abandoned-onboarding nudge: a member signed up but never finished onboarding (no
// onboarding_responses row), so they never got their plan. Nudge them ONCE, in-app + push. The
// window (12h..14d old) skips brand-new signups still mid-flow and ancient dead accounts; the
// "no existing onboarding_nudge notification" guard makes it fire exactly once per member.
export async function generateOnboardingNudges(): Promise<GeneratorResult> {
  const svc = createServiceClient();
  const now = Date.now();
  const olderThan = new Date(now - 12 * 3_600_000).toISOString(); // signed up > 12h ago
  const notBefore = new Date(now - 14 * 86_400_000).toISOString(); // and < 14 days ago

  const { data, error } = await svc
    .from('profiles')
    .select('id, company_id, ui_locale, created_at, onboarding_responses(profile_id), notifications(type)')
    .in('role', ['subscriber', 'free'])
    .lte('created_at', olderThan)
    .gte('created_at', notBefore);
  if (error) {
    return { ok: false, job: 'onboarding-nudge', selected: 0, notified: 0, error: error.message };
  }

  type Row = {
    id: string;
    company_id: string | null;
    ui_locale: string | null;
    onboarding_responses: { profile_id: string }[] | null;
    notifications: { type: string }[] | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const targets = rows.filter(
    (r) =>
      r.company_id &&
      (r.onboarding_responses?.length ?? 0) === 0 && // never onboarded
      !(r.notifications ?? []).some((n) => n.type === 'onboarding_nudge'), // not already nudged
  );
  if (targets.length === 0) return { ok: true, job: 'onboarding-nudge', selected: 0, notified: 0 };

  const recipients = targets.map((r) => {
    const locale: NotifLocale = asNotifLocale(r.ui_locale);
    const payload: NotificationPayload = {
      type: 'onboarding_nudge',
      title: notifText(locale, 'onboardingNudgeTitle'),
      body: notifText(locale, 'onboardingNudgeBody'),
      link: '/onboarding',
    };
    return { profileId: r.id, payload };
  });
  // Grouped by company (single-tenant today, but keep it correct): bulk-insert per company.
  const byCompany = new Map<string, typeof recipients>();
  for (const t of targets) {
    const list = byCompany.get(t.company_id as string) ?? [];
    const rec = recipients.find((x) => x.profileId === t.id);
    if (rec) list.push(rec);
    byCompany.set(t.company_id as string, list);
  }
  let notified = 0;
  for (const [companyId, recs] of byCompany) {
    await createNotificationsBulk(companyId, recs);
    notified += recs.length;
  }
  return { ok: true, job: 'onboarding-nudge', selected: targets.length, notified };
}

/**
 * Check-in due, at HER cadence, in the member's local evening.
 *
 * WHAT THIS USED TO DO. A hardcoded CHECKIN_QUIET_DAYS = 7, sent from the daily job at whatever UTC
 * hour pg_cron happened to fire, to anyone holding a published check-in assignment. It read none of
 * the seven columns migration 0115 added for exactly this and put on /coach/settings: the on/off
 * switch, the cadence, the weekday, the local time, and the skip-when-done pair. Stephanie runs
 * check-ins EVERY TWO WEEKS (2026-08-13), so the hardcoded 7 was about to nag 256 women at twice her
 * real cadence, on a settings screen that already had the right answer typed into it.
 *
 * NOW RUNS HOURLY, off notify-reminders rather than notify-checkins, because reminder_time_local and
 * reminder_weekday cannot be honoured by a job that fires once a day at a UTC hour. That route
 * already exists and already fires every hour precisely so per-timezone delivery works from one
 * schedule — the same mechanism generateLocalTimeReminders uses. No new pg_cron entry.
 *
 * OFF BY DEFAULT, and that is the column default, not a decision made here: is_checkin_reminder_on
 * defaults false in 0115. A coach who never opened the settings screen gets no automated check-in
 * nudges, which is the safe direction — the failure of sending nothing is a missed prompt, and the
 * failure of sending something is a message in Stephanie's voice that she did not authorise.
 */
export async function generateCheckinReminders(at: Date = new Date()): Promise<GeneratorResult> {
  const svc = createServiceClient();
  const job = 'checkins';

  const { data, error } = await svc
    .from('form_assignments')
    .select(
      'profile_id, company_id, form_id, forms!inner ( title_en, title_es, type, status ), profiles!inner ( ui_locale, timezone )',
    )
    .eq('forms.type', 'check_in')
    .eq('forms.status', 'published');
  if (error) return { ok: false, job, selected: 0, notified: 0, error: error.message };

  const rows = ((data ?? []) as unknown as AssignmentRow[]).filter((r) => r.forms);
  if (rows.length === 0) return { ok: true, job, selected: 0, notified: 0 };

  // Settings are per company and every row carries its company, so read each one once.
  const companyIds = [...new Set(rows.map((r) => r.company_id))];
  const settingsByCompany = new Map<string, CoachSettings>();
  for (const companyId of companyIds) {
    settingsByCompany.set(companyId, await readCoachSettings(companyId));
  }

  // Her clock, not the server's. A member in Guadalajara whose coach set "Monday 6pm" must get it
  // Monday at 6pm where she is; at 23:00 Sunday there it is already Monday in UTC.
  const dueNow = rows.filter((r) => {
    const settings = settingsByCompany.get(r.company_id);
    if (!settings?.isCheckinReminderOn) return false;
    const tz = r.profiles?.timezone ?? null;
    if (localHour(tz, at) !== reminderHourOf(settings.reminderTimeLocal)) return false;
    // The weekday gate applies to weekly AND monthly cadences: "every 2 months on a Monday" is a
    // Monday either way, and the every-N spacing is enforced by the dedupe below rather than here.
    return localWeekday(tz, at) === settings.reminderWeekday;
  });
  if (dueNow.length === 0) return { ok: true, job, selected: 0, notified: 0 };

  const formIds = [...new Set(dueNow.map((r) => r.form_id))];
  const profileIds = [...new Set(dueNow.map((r) => r.profile_id))];

  // The widest window any company on this list needs, fetched once. Filtering per member happens
  // below against that company's own numbers.
  const widestDays = Math.max(
    ...[...settingsByCompany.values()].map((s) =>
      Math.max(checkinCadenceDays(s.reminderEvery, s.reminderPeriod), s.reminderSkipDays),
    ),
  );
  const since = new Date(at.getTime() - widestDays * 86_400_000).toISOString();

  const [respRes, sentRes] = await Promise.all([
    svc
      .from('form_responses')
      .select('form_id, profile_id, submitted_at')
      .in('form_id', formIds)
      .in('profile_id', profileIds)
      .gte('submitted_at', since),
    // Cadence is enforced against what we already SENT, not against a stored schedule. That is what
    // makes "every two weeks" survive a missed cron run: the next hour it fires, the gap is still
    // open and she gets it, one hour late instead of two weeks late.
    svc
      .from('notifications')
      .select('profile_id, created_at')
      .eq('type', 'checkin')
      .in('profile_id', profileIds)
      .gte('created_at', since),
  ]);
  // Fail loud rather than silently treating everyone as un-answered (which would re-nudge people
  // who just checked in). A null/errored response set must not become an empty "answered" set.
  if (respRes.error)
    return { ok: false, job, selected: dueNow.length, notified: 0, error: respRes.error.message };
  if (sentRes.error)
    return { ok: false, job, selected: dueNow.length, notified: 0, error: sentRes.error.message };

  const answeredAt = new Map<string, string>();
  for (const r of (respRes.data ?? []) as { form_id: string; profile_id: string; submitted_at: string }[]) {
    const key = `${r.form_id}:${r.profile_id}`;
    const prev = answeredAt.get(key);
    if (!prev || r.submitted_at > prev) answeredAt.set(key, r.submitted_at);
  }
  const lastSentAt = new Map<string, string>();
  for (const r of (sentRes.data ?? []) as { profile_id: string; created_at: string }[]) {
    const prev = lastSentAt.get(r.profile_id);
    if (!prev || r.created_at > prev) lastSentAt.set(r.profile_id, r.created_at);
  }

  const eligible = dueNow.filter((r) => {
    const settings = settingsByCompany.get(r.company_id) as CoachSettings;
    const sent = lastSentAt.get(r.profile_id);
    const answered = answeredAt.get(`${r.form_id}:${r.profile_id}`);
    return isCheckinDue({
      lastSentAt: sent ? Date.parse(sent) : null,
      answeredAt: answered ? Date.parse(answered) : null,
      cadenceDays: checkinCadenceDays(settings.reminderEvery, settings.reminderPeriod),
      skipWhenDone: settings.isReminderSkippedWhenDone,
      skipDays: settings.reminderSkipDays,
      now: at.getTime(),
    });
  });

  // AT MOST ONE PER MEMBER PER RUN.
  //
  // A member can hold more than one published check-in form — the backfill script has a branch for
  // exactly that case — and the cadence dedupe reads notifications written BEFORE this run, so it
  // cannot see the message about to be sent for her second form. Without this she gets two pushes
  // in the same minute, every cycle, and each one suppresses the other next time.
  //
  // When there is a choice, remind her about the one she is furthest behind on: never answered
  // beats answered a month ago beats answered yesterday.
  const bestPerProfile = new Map<string, (typeof eligible)[number]>();
  for (const r of eligible) {
    const current = bestPerProfile.get(r.profile_id);
    if (!current) {
      bestPerProfile.set(r.profile_id, r);
      continue;
    }
    const a = answeredAt.get(`${r.form_id}:${r.profile_id}`) ?? '';
    const b = answeredAt.get(`${current.form_id}:${current.profile_id}`) ?? '';
    // '' sorts before any ISO timestamp, so a never-answered form wins.
    if (a < b) bestPerProfile.set(r.profile_id, r);
  }
  const due = [...bestPerProfile.values()];
  if (due.length === 0) return { ok: true, job, selected: dueNow.length, notified: 0 };

  const byCompany = new Map<string, Array<{ profileId: string; payload: NotificationPayload }>>();
  for (const r of due) {
    const locale = asNotifLocale(r.profiles?.ui_locale);
    const title =
      locale === 'es' ? (r.forms?.title_es ?? r.forms?.title_en ?? '') : (r.forms?.title_en ?? '');
    const payload: NotificationPayload = {
      type: 'checkin',
      title: notifText(locale, 'checkinDueTitle'),
      body: notifText(locale, 'checkinDueBody', { title }),
      link: `/forms/${r.form_id}`,
    };
    const list = byCompany.get(r.company_id) ?? [];
    list.push({ profileId: r.profile_id, payload });
    byCompany.set(r.company_id, list);
  }

  let notified = 0;
  for (const [companyId, recipients] of byCompany) {
    await createNotificationsBulk(companyId, recipients);
    notified += recipients.length;
  }
  return { ok: true, job, selected: due.length, notified };
}

// ---------------------------------------------------------------------------
// Local-time reminders: nudge active members whose CURRENT LOCAL HOUR equals their reminder_hour.
// pg_cron runs hourly in UTC; this filter is what makes "7pm in each user's zone" work (the timezone
// is per-user, DST-correct). In-app rows always deliver; push fires when VAPID keys are set.
// ---------------------------------------------------------------------------
type ReminderRow = {
  id: string;
  company_id: string;
  ui_locale: string | null;
  timezone: string | null;
  reminder_hour: number | null;
  role: string;
  comp_access_until: string | null;
};

export async function generateLocalTimeReminders(at: Date = new Date()): Promise<GeneratorResult> {
  const svc = createServiceClient();

  // The audience: subscribers and free users (the people with a daily-log habit to keep).
  const { data, error } = await svc
    .from('profiles')
    .select('id, company_id, ui_locale, timezone, reminder_hour, role, comp_access_until')
    .in('role', ['subscriber', 'free']);
  if (error) return { ok: false, job: 'reminders', selected: 0, notified: 0, error: error.message };

  const nowIso = at.toISOString();
  const rows = ((data ?? []) as ReminderRow[]).filter(
    // A free user whose comp has lapsed can't reach the app, so a daily reminder just dead-ends at
    // /checkout. Only remind subscribers + free users with a still-active comp.
    (r) => r.role !== 'free' || (r.comp_access_until != null && r.comp_access_until > nowIso),
  );
  // Keep only members whose local hour right now matches their reminder hour. Doing the hour math
  // in TS (one Intl call per row) avoids a SQL function and stays DST-correct via the IANA name.
  const dueNow = rows.filter((r) => localHour(r.timezone, at) === (r.reminder_hour ?? 19));
  if (dueNow.length === 0) return { ok: true, job: 'reminders', selected: 0, notified: 0 };

  const byCompany = new Map<string, Array<{ profileId: string; payload: NotificationPayload }>>();
  for (const r of dueNow) {
    const locale = asNotifLocale(r.ui_locale);
    const payload: NotificationPayload = {
      type: 'reminder',
      title: notifText(locale, 'reminderTitle'),
      body: notifText(locale, 'reminderBody'),
      link: '/dashboard',
    };
    const list = byCompany.get(r.company_id) ?? [];
    list.push({ profileId: r.id, payload });
    byCompany.set(r.company_id, list);
  }

  let notified = 0;
  for (const [companyId, recipients] of byCompany) {
    await createNotificationsBulk(companyId, recipients);
    notified += recipients.length;
  }
  return { ok: true, job: 'reminders', selected: dueNow.length, notified };
}

// ---------------------------------------------------------------------------
// Challenge close: finalize challenges past their ends_on (migration 0046 adds finalized_at). Awards
// the Challenge Champion badge to the top participant by progress, notifies every participant (the
// winner and the rest), and stamps finalized_at so each challenge is processed exactly once. Idempotent
// via finalized_at + the user_badges (profile_id, badge_id) unique constraint.
// ---------------------------------------------------------------------------
type EndedChallenge = { id: string; company_id: string; title: string };
type ChallengeParticipant = {
  profile_id: string;
  progress: number | string;
  profiles: { ui_locale: string | null; full_name: string | null } | null;
};

// Notify members when a challenge OPENS. Covers future-dated challenges (created to start later):
// on their real start day the leaderboard makes them visible, and this stamps start_notified_at so
// the "New challenge!" bell fires exactly then, once. Challenges created to start today are already
// notified + stamped at creation, so they are skipped here.
export async function generateChallengeOpenNotices(): Promise<GeneratorResult> {
  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await svc
    .from('challenges')
    .select('id, company_id, title, created_by')
    .lte('starts_on', today)
    .gte('ends_on', today)
    .is('start_notified_at', null);
  if (error) {
    return { ok: false, job: 'challenge-open', selected: 0, notified: 0, error: error.message };
  }
  const challenges = (data ?? []) as {
    id: string;
    company_id: string;
    title: string;
    created_by: string | null;
  }[];
  if (challenges.length === 0) return { ok: true, job: 'challenge-open', selected: 0, notified: 0 };

  let notified = 0;
  for (const ch of challenges) {
    await notifyNewChallenge({
      companyId: ch.company_id,
      createdByProfileId: ch.created_by ?? '',
      challengeTitle: ch.title,
    });
    await svc
      .from('challenges')
      .update({ start_notified_at: new Date().toISOString() })
      .eq('id', ch.id);
    notified += 1;
  }
  return { ok: true, job: 'challenge-open', selected: challenges.length, notified };
}

export async function finalizeEndedChallenges(): Promise<GeneratorResult> {
  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await svc
    .from('challenges')
    .select('id, company_id, title')
    .lt('ends_on', today)
    .is('finalized_at', null);
  if (error) {
    return { ok: false, job: 'close-challenges', selected: 0, notified: 0, error: error.message };
  }
  const challenges = (data ?? []) as EndedChallenge[];
  if (challenges.length === 0) return { ok: true, job: 'close-challenges', selected: 0, notified: 0 };

  // The badge the winner earns (seeded in 0046). Absent only if the migration has not run.
  const { data: badgeRow } = await svc
    .from('badges')
    .select('id')
    .eq('key', 'challenge_champion')
    .maybeSingle();
  const badgeId = (badgeRow as { id: string } | null)?.id ?? null;

  let notified = 0;
  for (const ch of challenges) {
    // Rank on REAL numbers: stored progress only refreshes on live activity hooks, so recompute the
    // whole board from workout/food logs before picking a winner (it was 0-forever before this).
    await recomputeChallengeBoard(ch.id);
    const { data: partData } = await svc
      .from('challenge_participants')
      .select('profile_id, progress, profiles!inner ( ui_locale, full_name )')
      .eq('challenge_id', ch.id)
      .order('progress', { ascending: false });
    const participants = (partData ?? []) as unknown as ChallengeParticipant[];

    // Winner = highest progress, but only if someone actually made progress.
    const winner = participants.find((p) => Number(p.progress) > 0) ?? null;
    const winnerName = winner?.profiles?.full_name ?? null;

    // Award the champion badge (idempotent via the user_badges unique on profile_id+badge_id).
    if (winner && badgeId) {
      await svc.from('user_badges').upsert(
        { company_id: ch.company_id, profile_id: winner.profile_id, badge_id: badgeId },
        { onConflict: 'profile_id,badge_id', ignoreDuplicates: true },
      );
    }

    // Notify every participant: the winner gets the win copy, everyone else the ended copy.
    const recipients = participants.map((p) => {
      const locale = asNotifLocale(p.profiles?.ui_locale);
      const isWinner = Boolean(winner) && winner!.profile_id === p.profile_id;
      const winnerLabel = winnerName ?? (locale === 'es' ? 'la comunidad' : 'the crew');
      const payload: NotificationPayload = isWinner
        ? {
            type: 'challenge_won',
            title: notifText(locale, 'challengeWonTitle'),
            body: notifText(locale, 'challengeWonBody', { title: ch.title }),
            link: '/community',
          }
        : {
            type: 'challenge_ended',
            title: notifText(locale, 'challengeEndedTitle'),
            body: notifText(locale, 'challengeEndedBody', { title: ch.title, winner: winnerLabel }),
            link: '/community',
          };
      return { profileId: p.profile_id, payload };
    });
    if (recipients.length > 0) {
      await createNotificationsBulk(ch.company_id, recipients);
      notified += recipients.length;
    }

    // Stamp finalized so the next nightly pass skips this challenge (idempotent close).
    await svc.from('challenges').update({ finalized_at: new Date().toISOString() }).eq('id', ch.id);
  }

  return { ok: true, job: 'close-challenges', selected: challenges.length, notified };
}

/**
 * The daily nudge during her period, at 6pm local, only when she has logged nothing.
 *
 * WHY 6PM AND NOT MORNING. A symptom log is a report on a day, and at 8am there is no day to report
 * on yet. Evening is also when she is most likely to have her phone and least likely to be mid-task.
 *
 * WHY ONLY DURING THE PERIOD PHASE. A tracker that pings every day of the month is a tracker that
 * gets its notifications switched off in week one, and then never reaches her on the days that
 * matter. The bleeding window is when symptom data is worth the interruption.
 *
 * WHY ONLY WHEN NOTHING IS LOGGED. Reminding someone to do a thing she already did is the fastest
 * way to teach her the reminders are not worth reading.
 *
 * Runs off the existing hourly notify-reminders cron rather than a new pg_cron entry: that job
 * already fires every hour precisely so per-timezone local-hour delivery works from one schedule.
 */
const CYCLE_REMINDER_HOUR = 18;

type CycleReminderRow = {
  profile_id: string;
  company_id: string;
  reminders_enabled: boolean;
};

export async function generateCycleReminders(at: Date = new Date()): Promise<GeneratorResult> {
  const svc = createServiceClient();

  const { data: profiles, error } = await svc
    .from('cycle_profiles')
    .select('profile_id, company_id, reminders_enabled')
    .eq('reminders_enabled', true);
  if (error) return { ok: false, job: 'cycle-reminders', selected: 0, notified: 0, error: error.message };

  const optedIn = (profiles ?? []) as CycleReminderRow[];
  if (optedIn.length === 0) return { ok: true, job: 'cycle-reminders', selected: 0, notified: 0 };

  // Timezone and locale live on profiles, not on cycle_profiles.
  const ids = optedIn.map((p) => p.profile_id);
  const { data: people } = await svc.from('profiles').select('id, ui_locale, timezone').in('id', ids);
  const meta = new Map(
    ((people ?? []) as { id: string; ui_locale: string | null; timezone: string | null }[]).map((p) => [p.id, p]),
  );

  const dueNow = optedIn.filter((p) => localHour(meta.get(p.profile_id)?.timezone ?? null, at) === CYCLE_REMINDER_HOUR);
  if (dueNow.length === 0) return { ok: true, job: 'cycle-reminders', selected: 0, notified: 0 };

  const dueIds = dueNow.map((p) => p.profile_id);
  // Open periods only: a period with an end date is over, and one with no end is still running.
  // 10 days is the cutoff for "still bleeding" on an unclosed log, so a forgotten one from March
  // does not nudge her every evening for five months.
  const todayIso = at.toISOString().slice(0, 10);
  const windowStart = new Date(at.getTime() - 10 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: openPeriods }, { data: loggedToday }] = await Promise.all([
    svc
      .from('cycle_logs')
      .select('profile_id')
      .in('profile_id', dueIds)
      .is('ended_on', null)
      .gte('started_on', windowStart),
    svc.from('cycle_day_logs').select('profile_id').in('profile_id', dueIds).eq('logged_on', todayIso),
  ]);

  const bleeding = new Set(((openPeriods ?? []) as { profile_id: string }[]).map((r) => r.profile_id));
  const alreadyLogged = new Set(((loggedToday ?? []) as { profile_id: string }[]).map((r) => r.profile_id));
  const targets = dueNow.filter((p) => bleeding.has(p.profile_id) && !alreadyLogged.has(p.profile_id));
  if (targets.length === 0) return { ok: true, job: 'cycle-reminders', selected: dueNow.length, notified: 0 };

  const byCompany = new Map<string, Array<{ profileId: string; payload: NotificationPayload }>>();
  for (const p of targets) {
    const locale: NotifLocale = asNotifLocale(meta.get(p.profile_id)?.ui_locale);
    const payload: NotificationPayload = {
      type: 'reminder',
      title: notifText(locale, 'cycleReminderTitle'),
      body: notifText(locale, 'cycleReminderBody'),
      link: '/you/cycle',
    };
    const list = byCompany.get(p.company_id) ?? [];
    list.push({ profileId: p.profile_id, payload });
    byCompany.set(p.company_id, list);
  }

  let notified = 0;
  for (const [companyId, recipients] of byCompany) {
    await createNotificationsBulk(companyId, recipients);
    notified += recipients.length;
  }
  return { ok: true, job: 'cycle-reminders', selected: targets.length, notified };
}

// ---------------------------------------------------------------------------
// Re-engagement ladder: the automated half of engagement risk.
//
// WHAT THIS CLOSES. Every other generator in this file is calendar-driven — a renewal date, a comp
// expiry, a check-in window, a reminder hour. None of them notice that a member stopped showing up,
// and the only thing in the app that used the word "risk" meant her card. So the first moment the
// system reacted to a woman quietly drifting away was the moment her payment failed, weeks after
// the decision was made. That is the wrong end of the problem: roughly half of the people who quit
// a gym do it inside 90 days, and a lapsing member stays winnable for about six weeks.
//
// THREE RUNGS, THEN A HUMAN. 7 days is a nudge, 14 asks what changed, 28 says a person will reach
// out and stops. Automation gets three tries because a fourth is nagging, and nagging a woman who
// is already avoiding the app is how "I'll come back next month" becomes "unsubscribe".
//
// THE 28-DAY MESSAGE MAKES A PROMISE THIS FILE CANNOT KEEP. It tells her a coach will reach out.
// What makes that true is /coach/quiet, the queue this same sweep feeds, in the same way
// /coach/awaiting is what keeps "Steph writes your plan by hand" honest. If that page stops being
// read, this message becomes a lie, and it is better to know that than to discover it from her.
//
// ONCE PER RUNG PER QUIET SPELL. The guard is not "have we ever sent this", it is "have we sent
// this since she was last active". A member who comes back in March and lapses again in June gets
// the whole ladder again, which is correct: it is a new lapse, and the old messages are why the
// naive version would have let her leave in silence the second time.
// ---------------------------------------------------------------------------
// Ceiling on the ladder's send-history read. The lookback is now bounded by the oldest quiet spell
// rather than by a calendar window, so it can in principle reach back years. Three rungs per member
// per spell means 5,000 rows covers this roster many times over; hitting it means something is wrong
// (a duplicate-send loop, or a roster an order of magnitude larger than this design assumed), and a
// truncated history reads as "nothing sent", which is exactly the resend bug the lookback fixes.
const REENGAGE_HISTORY_CAP = 5000;

// Same guard, same reason, for the lifecycle read. Five milestones per member means this roster
// could not approach it; reaching it means something is duplicating sends.
const LIFECYCLE_HISTORY_CAP = 5000;

// Same guard again. A campaign addresses a whole cohort, so this is the read most likely to grow —
// one row per member per campaign per year — and a truncated history reads as "nothing sent", which
// would re-broadcast to everyone who already received it.
const SEASONAL_HISTORY_CAP = 20000;

/**
 * The dedupe tag a seasonal notification carries in `link`.
 *
 * notifications has no campaign column and needs none: the key plus the run year in the link makes
 * "who already got the December 2026 one" a single equality match. The member sees a normal in-app
 * link; the query string is inert to the router.
 */
function campaignLinkTag(key: string, year: number): string {
  return `/dashboard?c=${encodeURIComponent(key)}-${year}`;
}

const REENGAGE_COPY: Record<7 | 14 | 28, { key: string; link: string }> = {
  7: { key: 'reengage7', link: '/dashboard' },
  // Sends her to the coach thread rather than the workout list on purpose. At two weeks the barrier
  // is almost never "she forgot where the button is", it is that the plan stopped fitting her week,
  // and the only thing that fixes that is telling someone.
  14: { key: 'reengage14', link: '/coach-chat' },
  28: { key: 'reengage28', link: '/dashboard' },
};

// No injected clock, unlike its neighbours. getEngagementSweep reads `new Date()` internally, so an
// `at` parameter here only ever advertised a testability this function does not have — and the one
// place it was used (a fixed lookback window) is exactly what the resend bug came from.
export async function generateReengagementNudges(): Promise<GeneratorResult> {
  const svc = createServiceClient();
  const job = 'reengagement';

  const { data: companyData, error: companyErr } = await svc.from('companies').select('id');
  if (companyErr) return { ok: false, job, selected: 0, notified: 0, error: companyErr.message };
  const companyIds = ((companyData ?? []) as { id: string }[]).map((c) => c.id);

  let selected = 0;
  let notified = 0;

  for (const companyId of companyIds) {
    const { rows } = await getEngagementSweep(companyId);
    const due: LadderCandidate[] = [];
    const rowBy = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const stage = reengageStage(r.daysQuiet);
      if (stage === null) continue;
      due.push({ profileId: r.profileId, quietSince: r.quietSince, stage });
      rowBy.set(r.profileId, r);
    }
    if (due.length === 0) continue;
    selected += due.length;

    // One query for the whole cohort's ladder history, reaching back to the oldest quiet spell in
    // it. NOT a fixed window: see ladderLookbackDay for the resend loop a flat 90 days caused.
    const lookback = ladderLookbackDay(due);
    if (lookback === null) continue;
    const { data: sentData, error: sentErr } = await svc
      .from('notifications')
      .select('profile_id, type, created_at')
      .eq('company_id', companyId)
      .in('profile_id', due.map((d) => d.profileId))
      .in('type', [...REENGAGE_TYPE_LIST])
      .gte('created_at', `${lookback}T00:00:00Z`)
      .limit(REENGAGE_HISTORY_CAP);
    // Fail loud, twice over. An errored history read that fell through as "nothing sent" would
    // re-send every rung to every quiet member on every run, which is the single worst thing this
    // file could do — and a SATURATED read is the same bug wearing a success code, now that the
    // lookback is unbounded in time. Sending nothing and logging it beats sending all of it.
    if (sentErr) return { ok: false, job, selected, notified, error: sentErr.message };
    const history = (sentData ?? []) as { profile_id: string; type: string; created_at: string }[];
    if (history.length >= REENGAGE_HISTORY_CAP) {
      return {
        ok: false,
        job,
        selected,
        notified,
        error: `ladder history hit the ${REENGAGE_HISTORY_CAP}-row cap; refusing to send on a partial read`,
      };
    }
    // profile+rung -> the most recent day that rung was delivered.
    const lastSent = new Map<string, string>();
    for (const r of history) {
      const key = ladderHistoryKey(r.profile_id, r.type);
      const day = r.created_at.slice(0, 10);
      const prev = lastSent.get(key);
      if (!prev || day > prev) lastSent.set(key, day);
    }

    const recipients: Array<{ profileId: string; payload: NotificationPayload }> = [];
    for (const { profileId, stage } of selectLadderSends(due, lastSent)) {
      const row = rowBy.get(profileId);
      if (!row) continue;
      const locale = asNotifLocale(row.locale);
      const copy = REENGAGE_COPY[stage];
      recipients.push({
        profileId,
        payload: {
          type: REENGAGE_TYPES[stage],
          title: notifText(locale, `${copy.key}Title`),
          body: notifText(locale, `${copy.key}Body`),
          link: copy.link,
        },
      });
    }

    if (recipients.length === 0) continue;
    await createNotificationsBulk(companyId, recipients);
    notified += recipients.length;
  }

  return { ok: true, job, selected, notified };
}

// ---------------------------------------------------------------------------
// The tenure lifecycle: day 7, 14, 30, 45, 90.
//
// The counterpart to the re-engagement ladder, and deliberately its opposite. The ladder reaches a
// woman who stopped; this reaches a woman who did not. Before it, the only tenure-driven message in
// the whole app was generateOnboardingNudges, which fires once, inside the first 14 days, only to
// members who never onboarded — so a member who DID onboard and kept training heard nothing about
// her own progress, ever, from the system.
//
// THE SUPPRESSION IS THE FEATURE. Anyone the sweep classifies as at risk is skipped, because
// "you've been at this a month, look what you built" landing on a woman who has not logged anything
// in three weeks proves nobody is looking. She gets the ladder instead. Both read the same sweep in
// the same run, so the two can never disagree about who she is.
//
// See lifecycle-shared.ts for the grace window, which is what makes this safe to switch on against
// an existing roster rather than emptying five milestones into 256 migrating members at once.
// ---------------------------------------------------------------------------
export async function generateLifecycleNudges(): Promise<GeneratorResult> {
  const svc = createServiceClient();
  const job = 'lifecycle';

  const { data: companyData, error: companyErr } = await svc.from('companies').select('id');
  if (companyErr) return { ok: false, job, selected: 0, notified: 0, error: companyErr.message };
  const companyIds = ((companyData ?? []) as { id: string }[]).map((c) => c.id);

  let selected = 0;
  let notified = 0;

  for (const companyId of companyIds) {
    const { rows } = await getEngagementSweep(companyId);
    const due: LifecycleCandidate[] = [];
    const rowBy = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      // She is being chased, not celebrated. The ladder owns her this run.
      if (isEngagementRisk(r.tier)) continue;
      const stage = lifecycleStage(r.memberAgeDays);
      if (stage === null) continue;
      due.push({ profileId: r.profileId, stage });
      rowBy.set(r.profileId, r);
    }
    if (due.length === 0) continue;
    selected += due.length;

    // No time bound, because the guard is "ever" rather than "since an anchor" — tenure only moves
    // forward. Bounded instead by the cohort (at most one row per member per milestone) and capped,
    // for the same reason the ladder is: a truncated history reads as "nothing sent".
    const { data: sentData, error: sentErr } = await svc
      .from('notifications')
      .select('profile_id, type')
      .eq('company_id', companyId)
      .in('profile_id', due.map((d) => d.profileId))
      .in('type', LIFECYCLE_TYPE_LIST)
      .limit(LIFECYCLE_HISTORY_CAP);
    if (sentErr) return { ok: false, job, selected, notified, error: sentErr.message };
    const history = (sentData ?? []) as { profile_id: string; type: string }[];
    if (history.length >= LIFECYCLE_HISTORY_CAP) {
      return {
        ok: false,
        job,
        selected,
        notified,
        error: `lifecycle history hit the ${LIFECYCLE_HISTORY_CAP}-row cap; refusing to send on a partial read`,
      };
    }
    const sent = new Set(history.map((r) => lifecycleHistoryKey(r.profile_id, r.type)));

    const recipients: Array<{ profileId: string; payload: NotificationPayload }> = [];
    for (const { profileId, stage } of selectLifecycleSends(due, sent)) {
      const row = rowBy.get(profileId);
      if (!row) continue;
      const locale = asNotifLocale(row.locale);
      const key = LIFECYCLE_COPY_KEY[stage];
      recipients.push({
        profileId,
        payload: {
          type: LIFECYCLE_TYPES[stage],
          title: notifText(locale, `${key}Title`),
          body: notifText(locale, `${key}Body`),
          link: LIFECYCLE_LINK[stage],
        },
      });
    }

    if (recipients.length === 0) continue;
    await createNotificationsBulk(companyId, recipients);
    notified += recipients.length;
  }

  return { ok: true, job, selected, notified };
}

// ---------------------------------------------------------------------------
// Seasonal campaigns: the third and last automated sender, and the only one that can address a
// whole cohort on a single day.
//
// The other two are per-member by construction — the ladder fires on HER quiet days, the lifecycle
// on HER tenure — so the worst either can do on a bad day is reach one woman wrongly. This one
// fires on the calendar, so a mistake reaches everybody at once. Everything about it is arranged
// around that asymmetry:
//
//   * The table ships EMPTY and every row defaults to inactive. Nothing sends until somebody writes
//     a campaign and switches it on.
//   * A malformed window fails CLOSED (isSeasonActive returns false), so a typo sends to nobody
//     rather than to the roster.
//   * A tenure floor per campaign, defaulting to 14 days, so a woman who joined on 20 December is
//     not told on the 26th not to give up on her goals.
//   * The audience test reads `atRisk` off the SAME sweep the other two generators just used, so a
//     woman cannot receive a win-back and a seasonal push in the same minute.
//
// Runs last in the daily job for that final reason: by the time it selects, the ladder and the
// lifecycle have already made their decisions from the same view of the roster.
// ---------------------------------------------------------------------------
export async function generateSeasonalCampaigns(at: Date = new Date()): Promise<GeneratorResult> {
  const svc = createServiceClient();
  const job = 'seasonal';
  const today = at.toISOString().slice(0, 10);

  const { data: companyData, error: companyErr } = await svc.from('companies').select('id');
  if (companyErr) return { ok: false, job, selected: 0, notified: 0, error: companyErr.message };
  const companyIds = ((companyData ?? []) as { id: string }[]).map((c) => c.id);

  let selected = 0;
  let notified = 0;

  for (const companyId of companyIds) {
    const { data: campaignData, error: campaignErr } = await svc
      .from('seasonal_campaigns')
      .select('id, key, starts_md, ends_md, audience, min_tenure_days, title_en, body_en, title_es, body_es, link, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true);
    if (campaignErr) return { ok: false, job, selected, notified, error: campaignErr.message };

    type Row = {
      id: string;
      key: string;
      starts_md: string;
      ends_md: string;
      audience: string;
      min_tenure_days: number;
      title_en: string;
      body_en: string;
      title_es: string;
      body_es: string;
      link: string;
    };
    const all = (campaignData ?? []) as Row[];
    const rows: CampaignRow[] = all.map((c) => ({
      id: c.id,
      key: c.key,
      startsMd: c.starts_md,
      endsMd: c.ends_md,
      // A stored value outside the union means the row was written by something other than the UI.
      // Falling back to the narrowest audience is the safe direction: 'all' would broadcast.
      audience: isCampaignAudience(c.audience) ? c.audience : 'active',
      minTenureDays: c.min_tenure_days,
      isActive: true,
    }));
    const live = activeCampaigns(rows, today);
    if (live.length === 0) continue;

    // The same sweep the ladder and the lifecycle read, so "she has gone quiet" has one answer today.
    const { rows: sweep } = await getEngagementSweep(companyId);
    const members: CampaignMember[] = sweep.map((r) => ({
      profileId: r.profileId,
      memberAgeDays: r.memberAgeDays,
      atRisk: isEngagementRisk(r.tier),
    }));
    if (members.length === 0) continue;
    const localeBy = new Map(sweep.map((r) => [r.profileId, r.locale]));
    const bodyBy = new Map(all.map((c) => [c.key, c]));

    for (const campaign of live) {
      const year = seasonYear(campaign.startsMd, campaign.endsMd, today);
      const { data: sentData, error: sentErr } = await svc
        .from('notifications')
        .select('profile_id, link')
        .eq('company_id', companyId)
        .eq('type', 'seasonal')
        // The campaign key and the run year ride the link, so one query answers "who already got
        // THIS campaign THIS year" without a column on notifications. Matching on the exact string
        // rather than a prefix keeps last year's send from suppressing this year's.
        .eq('link', campaignLinkTag(campaign.key, year))
        .limit(SEASONAL_HISTORY_CAP);
      if (sentErr) return { ok: false, job, selected, notified, error: sentErr.message };
      const history = (sentData ?? []) as { profile_id: string }[];
      if (history.length >= SEASONAL_HISTORY_CAP) {
        return {
          ok: false,
          job,
          selected,
          notified,
          error: `seasonal history hit the ${SEASONAL_HISTORY_CAP}-row cap; refusing to send on a partial read`,
        };
      }
      const sent = new Set(history.map((r) => campaignHistoryKey(r.profile_id, campaign.key, year)));

      const due = selectCampaignRecipients(campaign, members, sent, year);
      selected += due.length;
      if (due.length === 0) continue;

      const copy = bodyBy.get(campaign.key);
      if (!copy) continue;
      const recipients = due.map((m) => {
        const es = asNotifLocale(localeBy.get(m.profileId)) === 'es';
        return {
          profileId: m.profileId,
          payload: {
            type: 'seasonal' as const,
            title: es ? copy.title_es : copy.title_en,
            body: es ? copy.body_es : copy.body_en,
            link: campaignLinkTag(campaign.key, year),
          },
        };
      });
      await createNotificationsBulk(companyId, recipients);
      notified += recipients.length;
    }
  }

  return { ok: true, job, selected, notified };
}

// ---------------------------------------------------------------------------
// Plan follow-ups: the first notification in this app addressed at the COACH.
//
// Every other generator here fires at a member. On 2026-08-13 Stephanie asked for a reminder a week
// before a 12-week program ends, and the answer on the call was that reminders were already built.
// They were, for members. Nothing had ever told the coach anything, which is why a program could
// quietly expire under a client who was still paying.
//
// NO SCHEMA CHANGE NEEDED. notifications is profile-keyed and coaches have profiles, so the existing
// bell, the existing push and the existing preference gate all work as-is. That is worth more than a
// dedicated coach-tasks table would have been: she already knows where the bell is.
//
// DEDUPE PER PLAN PER CYCLE. The assignment id goes in the link, and a rung is spent once a
// notification carrying that link exists. Without it, an hourly-ish daily job would tell her about
// the same expiring program every morning for a week, which is how a person learns to ignore the
// bell.
// ---------------------------------------------------------------------------
export async function generatePlanFollowupReminders(at: Date = new Date()): Promise<GeneratorResult> {
  const svc = createServiceClient();
  const job = 'plan-followups';

  const { data: companyData, error: companyErr } = await svc.from('companies').select('id');
  if (companyErr) return { ok: false, job, selected: 0, notified: 0, error: companyErr.message };
  const companyIds = ((companyData ?? []) as { id: string }[]).map((c) => c.id);

  let selected = 0;
  let notified = 0;

  for (const companyId of companyIds) {
    const { items } = await listExpiringPlans(companyId, at);
    if (items.length === 0) continue;
    selected += items.length;

    // Who to tell. COACH_ROLES excludes operators on purpose: an operator is ops, not the person who
    // writes the next block, and a queue that pages everybody is a queue nobody owns.
    const { data: coachData, error: coachErr } = await svc
      .from('profiles')
      .select('id, ui_locale')
      .eq('company_id', companyId)
      .in('role', ['coach', 'assistant_coach']);
    if (coachErr) return { ok: false, job, selected, notified, error: coachErr.message };
    const coaches = (coachData ?? []) as { id: string; ui_locale: string | null }[];
    if (coaches.length === 0) continue;

    const links = items.map((i) => `/coach/plan-renewals#${i.kind}-${i.id}`);
    const { data: sentData, error: sentErr } = await svc
      .from('notifications')
      .select('profile_id, link')
      .eq('company_id', companyId)
      .in('type', ['plan_expiring'])
      .in('link', links);
    // Fail loud. Treating an errored read as "nothing sent" would re-announce every expiring plan to
    // every coach on every run.
    if (sentErr) return { ok: false, job, selected, notified, error: sentErr.message };
    const already = new Set(
      ((sentData ?? []) as { profile_id: string; link: string | null }[]).map(
        (r) => `${r.profile_id}|${r.link ?? ''}`,
      ),
    );

    const recipients: Array<{ profileId: string; payload: NotificationPayload }> = [];
    for (const item of items) {
      const link = `/coach/plan-renewals#${item.kind}-${item.id}`;
      for (const coach of coaches) {
        if (already.has(`${coach.id}|${link}`)) continue;
        const locale = asNotifLocale(coach.ui_locale);
        const key = item.daysLeft < 0 ? 'planExpiredBody' : 'planExpiringBody';
        recipients.push({
          profileId: coach.id,
          payload: {
            type: 'plan_expiring',
            title: notifText(locale, 'planExpiringTitle'),
            body: notifText(locale, key, {
              name: item.memberName,
              plan: item.planName,
              days: String(Math.abs(item.daysLeft)),
            }),
            link,
          },
        });
      }
    }

    if (recipients.length === 0) continue;
    await createNotificationsBulk(companyId, recipients);
    notified += recipients.length;
  }

  return { ok: true, job, selected, notified };
}

// ---------------------------------------------------------------------------
// Auto-resume: end a pause on the day it was agreed to end.
//
// A pause with a resume date that nobody actions is a cancellation with extra steps. Stephanie
// agrees "back on 9-8" with a member; if 9-8 arrives and the app still shows her a break page, the
// promise the pause was built on is broken by silence, on the exact day she was ready to come back.
//
// REVOKES the pause grant, and grants NOTHING. Her access after the break is whatever Stripe, Apple
// or a comp already says it is. A resume that minted an active grant would keep serving a member
// whose subscription lapsed during the pause, which is how a break turns into free coaching.
//
// Rides the existing daily job. Same reason as the re-engagement ladder: a feature whose entire
// value is working while nobody is watching must not depend on someone registering a schedule.
// ---------------------------------------------------------------------------
export async function resumeDuePauses(at: Date = new Date()): Promise<GeneratorResult> {
  const svc = createServiceClient();
  const job = 'auto-resume';

  // Due = the agreed date has arrived. Open-ended pauses (expires_at null) are never auto-resumed:
  // "pause me until I say" means until she says.
  const { data, error } = await svc
    .from('entitlements')
    .select('id, company_id, profile_id')
    .eq('status', 'paused')
    .not('expires_at', 'is', null)
    .lte('expires_at', at.toISOString());
  if (error) return { ok: false, job, selected: 0, notified: 0, error: error.message };

  const due = (data ?? []) as { id: string; company_id: string; profile_id: string }[];
  if (due.length === 0) return { ok: true, job, selected: 0, notified: 0 };

  const { error: updateErr } = await svc
    .from('entitlements')
    .update({ status: 'revoked', updated_at: at.toISOString() })
    .in('id', due.map((d) => d.id));
  if (updateErr) return { ok: false, job, selected: due.length, notified: 0, error: updateErr.message };

  // Tell her she is back. Landing on a normal dashboard with no explanation after weeks away is
  // fine; being told "your break is over, here is where you left off" is the difference between an
  // app that ran a state machine and a coach who remembered.
  const byCompany = new Map<string, Array<{ profileId: string; payload: NotificationPayload }>>();
  const { data: profileData } = await svc
    .from('profiles')
    .select('id, ui_locale')
    .in('id', due.map((d) => d.profile_id));
  const localeBy = new Map(
    ((profileData ?? []) as { id: string; ui_locale: string | null }[]).map((p) => [p.id, p.ui_locale]),
  );

  for (const d of due) {
    const locale = asNotifLocale(localeBy.get(d.profile_id));
    const list = byCompany.get(d.company_id) ?? [];
    list.push({
      profileId: d.profile_id,
      payload: {
        type: 'system',
        title: notifText(locale, 'resumeTitle'),
        body: notifText(locale, 'resumeBody'),
        link: '/dashboard',
      },
    });
    byCompany.set(d.company_id, list);
  }

  let notified = 0;
  for (const [companyId, recipients] of byCompany) {
    await createNotificationsBulk(companyId, recipients);
    notified += recipients.length;
  }
  return { ok: true, job, selected: due.length, notified };
}
