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
import { localHour } from '@/lib/datetime/local-day';
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
const RENEWAL_LEAD_DAYS = 3;
const COMP_LEAD_DAYS = 3;
// A check-in is "due" if there is no response within this window.
const CHECKIN_QUIET_DAYS = 7;

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
// Check-in due: published check-in forms assigned to a member with no response in CHECKIN_QUIET_DAYS.
// ---------------------------------------------------------------------------
type AssignmentRow = {
  profile_id: string;
  company_id: string;
  form_id: string;
  forms: { title_en: string; title_es: string | null; type: string; status: string } | null;
  profiles: { ui_locale: string | null } | null;
};

export async function generateCheckinReminders(): Promise<GeneratorResult> {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from('form_assignments')
    .select(
      'profile_id, company_id, form_id, forms!inner ( title_en, title_es, type, status ), profiles!inner ( ui_locale )',
    )
    .eq('forms.type', 'check_in')
    .eq('forms.status', 'published');
  if (error) return { ok: false, job: 'checkins', selected: 0, notified: 0, error: error.message };

  const rows = ((data ?? []) as unknown as AssignmentRow[]).filter((r) => r.forms);
  if (rows.length === 0) return { ok: true, job: 'checkins', selected: 0, notified: 0 };

  // Pull recent responses once, then exclude any (form, profile) answered within the quiet window.
  const since = new Date(Date.now() - CHECKIN_QUIET_DAYS * 86_400_000).toISOString();
  const formIds = [...new Set(rows.map((r) => r.form_id))];
  const profileIds = [...new Set(rows.map((r) => r.profile_id))];
  const { data: resp } = await svc
    .from('form_responses')
    .select('form_id, profile_id')
    .in('form_id', formIds)
    .in('profile_id', profileIds)
    .gte('created_at', since);
  const answered = new Set(
    ((resp ?? []) as { form_id: string; profile_id: string }[]).map(
      (r) => `${r.form_id}:${r.profile_id}`,
    ),
  );

  const due = rows.filter((r) => !answered.has(`${r.form_id}:${r.profile_id}`));
  if (due.length === 0) return { ok: true, job: 'checkins', selected: 0, notified: 0 };

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
  return { ok: true, job: 'checkins', selected: due.length, notified };
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
};

export async function generateLocalTimeReminders(at: Date = new Date()): Promise<GeneratorResult> {
  const svc = createServiceClient();

  // The audience: subscribers and free users (the people with a daily-log habit to keep).
  const { data, error } = await svc
    .from('profiles')
    .select('id, company_id, ui_locale, timezone, reminder_hour')
    .in('role', ['subscriber', 'free']);
  if (error) return { ok: false, job: 'reminders', selected: 0, notified: 0, error: error.message };

  const rows = (data ?? []) as ReminderRow[];
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
