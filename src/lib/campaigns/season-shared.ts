// The seasonal calendar: the pure part.
//
// WHAT THIS CLOSES. .planning/OPERATOR-GAPS.md Part 3: nothing in this codebase is calendar-aware.
// Every cron is "daily", "hourly" or "every 6h", and the business is strongly seasonal — January is
// the most profitable month, July and August are the slump, and December has the highest
// cancellation rate of the year. The December save window arrives and nothing runs.
//
// TWO OF PART 3'S THREE ASKS WERE CLOSED ELSEWHERE and are deliberately not rebuilt here. The
// "hold/pause option for summer travel" is the pause feature (migration 0140). The "January cohort
// hits its 90-day cliff in April, unattended" is generateLifecycleNudges, which reaches every member
// on HER day 90 rather than approximating a cohort by the calendar — strictly better, and it means
// this file must not also try to own retention-by-tenure. What is left is the third ask: dated
// campaigns that fire whether or not anyone remembers they exist.
//
// WINDOWS ARE MONTH-DAY AND RECUR EVERY YEAR. A season is not a date, it is the same fortnight of
// every December, and a campaign stored as an absolute date is one somebody has to remember to move
// — which is the thing being fixed. The cost is the wrap-around case below, which is why it has its
// own function and its own tests.
//
// NOTHING SENDS UNTIL SHE WRITES ONE AND SWITCHES IT ON. Campaigns are rows, they default to
// inactive, and the table is empty on the day this ships. That is the same shape as
// STARTER_PROGRAM_ID and the scan auto-accept flag, and it is load-bearing here: this is the only
// generator in the app that can address a whole cohort on one day, so it must not be able to do
// that by accident.

/** 'MM-DD'. The year is deliberately absent: a season recurs. */
export type MonthDay = string;

const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isMonthDay(value: string): boolean {
  return MD.test(value);
}

/**
 * Is `today` inside a recurring month-day window? Both ends inclusive.
 *
 * THE WRAP-AROUND IS THE WHOLE REASON THIS IS A FUNCTION. The most valuable window in the year runs
 * '12-26' to '01-05', and for that one `start <= today && today <= end` is false on every single day
 * it should be true — 12-31 is not <= 01-05, and 01-02 is not >= 12-26. A campaign written for the
 * week people quit would have fired on exactly none of those days, silently, and the failure looks
 * identical to nobody having written one.
 */
export function isSeasonActive(startsMd: MonthDay, endsMd: MonthDay, today: string): boolean {
  if (!isMonthDay(startsMd) || !isMonthDay(endsMd)) return false;
  const md = today.slice(5, 10);
  if (!isMonthDay(md)) return false;
  // A window that ends before it starts is a window that crosses New Year, and it is satisfied by
  // being past the start OR before the end rather than both.
  return startsMd <= endsMd ? md >= startsMd && md <= endsMd : md >= startsMd || md <= endsMd;
}

/**
 * Which run of a recurring season today belongs to, as a year.
 *
 * The dedupe key needs to say "she got the December 2026 one", so that the same campaign reaches
 * her again next December and never twice in one. For a wrap-around window the January days belong
 * to the season that STARTED the previous December — otherwise a member gets it on 30 December and
 * again on 2 January, four days apart, which is the same failure as the day-28 resend.
 */
export function seasonYear(startsMd: MonthDay, endsMd: MonthDay, today: string): number {
  const year = Number(today.slice(0, 4));
  if (!Number.isFinite(year)) return 0;
  const md = today.slice(5, 10);
  // Wrapping window, and we are in the tail (January side): the season began last year.
  if (startsMd > endsMd && md <= endsMd) return year - 1;
  return year;
}

/** Who a campaign is for. Named rather than a boolean because the third option is the interesting one. */
export type CampaignAudience =
  /** Everyone past the tenure floor. */
  | 'all'
  /** Only members who are still showing up. The re-engagement ladder owns the rest. */
  | 'active'
  /** ONLY members the sweep flags at risk — a save campaign aimed at the people actually wavering. */
  | 'at_risk';

export const CAMPAIGN_AUDIENCES: CampaignAudience[] = ['all', 'active', 'at_risk'];

export function isCampaignAudience(value: string): value is CampaignAudience {
  return (CAMPAIGN_AUDIENCES as string[]).includes(value);
}

/**
 * Default tenure floor, in days.
 *
 * A woman who joined on 20 December must not be told on the 26th not to give up on her goals. Two
 * weeks is short enough that a genuine December campaign still reaches most of the roster and long
 * enough that nobody gets a save message before her first check-in.
 */
export const DEFAULT_MIN_TENURE_DAYS = 14;

export type CampaignRow = {
  id: string;
  key: string;
  startsMd: MonthDay;
  endsMd: MonthDay;
  audience: CampaignAudience;
  minTenureDays: number;
  isActive: boolean;
};

export type CampaignMember = {
  profileId: string;
  memberAgeDays: number;
  /** From the engagement sweep, so this and the ladders cannot disagree about who she is. */
  atRisk: boolean;
};

/** Dedupe key: one send per member per campaign per RUN of that season. */
export function campaignHistoryKey(profileId: string, campaignKey: string, year: number): string {
  return `${profileId}|${campaignKey}|${year}`;
}

/**
 * The campaigns that should be sending today.
 *
 * Inactive rows are dropped here rather than at the query so that "why did nothing send" has one
 * answer to check.
 */
export function activeCampaigns(rows: readonly CampaignRow[], today: string): CampaignRow[] {
  return rows.filter((c) => c.isActive && isSeasonActive(c.startsMd, c.endsMd, today));
}

/**
 * Who in this cohort should receive `campaign` today.
 *
 * The audience test reads `atRisk` straight off the engagement sweep rather than recomputing it, for
 * the same reason generateLifecycleNudges does: two definitions of "she has gone quiet" on one day
 * is how a woman gets a win-back and a seasonal push in the same minute.
 */
export function selectCampaignRecipients(
  campaign: CampaignRow,
  members: readonly CampaignMember[],
  sent: ReadonlySet<string>,
  year: number,
): CampaignMember[] {
  return members.filter((m) => {
    if (m.memberAgeDays < campaign.minTenureDays) return false;
    if (campaign.audience === 'active' && m.atRisk) return false;
    if (campaign.audience === 'at_risk' && !m.atRisk) return false;
    return !sent.has(campaignHistoryKey(m.profileId, campaign.key, year));
  });
}
