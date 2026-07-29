'use server';
// Operator-only actions for the /admin/waitlist/suppression-qa harness.
//
// runSuppressionQaAction seeds a throwaway lead via the SAME submitSignup path production traffic
// uses, waits briefly for fire-and-forget side effects to settle, then walks the row's state
// machine (created -> confirmed -> converted) and asserts the two suppression columns flip at the
// right moments and never before. Nothing in this file is idempotent by design: each run creates
// a fresh qa-<ts>@test.local so the test.local domain black-holes the outbound confirmation email.
//
// cleanupSuppressionQaAction sweeps every qa-*@test.local row so the QA rows never pollute real
// metrics on /admin/waitlist. Operator only, rate-limited, revalidates the page after each action.
import { revalidatePath } from 'next/cache';
import { requireOperator } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { submitSignup, confirmLeadByToken, convertLead } from '@/lib/funnel/service';
import {
  deleteQaLeads,
  readQaLead,
  QA_EMAIL_DOMAIN,
  QA_EMAIL_PREFIX,
  type CleanupResult,
  type QaResult,
  type QaStep,
} from '@/lib/admin/suppression-qa';

const RUN_BUCKET = 'admin-suppression-qa';
const RUN_LIMIT = 10;
const RUN_WINDOW_SEC = 300;

// The two-second pause between submitSignup returning and our first re-read. submitSignup fires
// sendLeadMagnet / enrollInDrip / sendWaitlistConfirmation as fire-and-forget; on a warm lambda
// they settle in a few hundred ms, but a cold-start GHL upsert can push past a second. Two seconds
// gives us headroom without making the harness feel slow on a happy path.
const SETTLE_MS = 2000;

function step(name: string, ok: boolean, detail: string): QaStep {
  return { name, ok, detail };
}

function ratedLimitedResult(email: string | null): QaResult {
  const now = new Date().toISOString();
  return {
    overall: 'fail',
    email,
    leadId: null,
    steps: [step('rate limit', false, 'Too many QA runs. Wait a few minutes and try again.')],
    startedAt: now,
    finishedAt: now,
  };
}

export async function runSuppressionQaAction(): Promise<QaResult> {
  const ctx = await requireOperator();
  if (!ctx.companyId) {
    const now = new Date().toISOString();
    return {
      overall: 'fail',
      email: null,
      leadId: null,
      steps: [step('operator scope', false, 'Your account has no company scope.')],
      startedAt: now,
      finishedAt: now,
    };
  }
  const allowed = await checkRateLimit(ctx.userId, RUN_BUCKET, RUN_LIMIT, RUN_WINDOW_SEC);
  if (!allowed) return ratedLimitedResult(null);

  const startedAt = new Date().toISOString();
  const email = `${QA_EMAIL_PREFIX}${Date.now()}@${QA_EMAIL_DOMAIN}`;
  const steps: QaStep[] = [];
  let leadId: string | null = null;

  // ---------- Phase 1: signup ----------
  try {
    const res = await submitSignup({
      email,
      first_name: 'QA',
      last_name: 'Harness',
      locale: 'en',
      source: 'admin-suppression-qa',
    });
    leadId = res.leadId;
    steps.push(step('submitSignup returned lead id', true, `leadId=${res.leadId}, referralCode=${res.referralCode}, entryCount=${res.entryCount}`));
  } catch (e: unknown) {
    steps.push(step('submitSignup returned lead id', false, e instanceof Error ? e.message : String(e)));
    revalidatePath('/admin/waitlist/suppression-qa');
    return { overall: 'fail', email, leadId, steps, startedAt, finishedAt: new Date().toISOString() };
  }

  // Let fire-and-forget side effects settle (sendLeadMagnet, enrollInDrip, sendWaitlistConfirmation).
  await sleep(SETTLE_MS);

  // ---------- Phase 2: read back post-signup state ----------
  const postSignup = await readQaLead(email);
  if (!postSignup) {
    steps.push(step('row created', false, 'No waitlist_leads row found after signup.'));
    revalidatePath('/admin/waitlist/suppression-qa');
    return { overall: 'fail', email, leadId, steps, startedAt, finishedAt: new Date().toISOString() };
  }
  steps.push(step('row created', true, `waitlist_leads row exists (id=${postSignup.id})`));

  steps.push(
    step(
      'confirm_token set + entry_count=1',
      Boolean(postSignup.confirm_token) && postSignup.entry_count === 1,
      `confirm_token=${postSignup.confirm_token ? 'present' : 'MISSING'}, entry_count=${postSignup.entry_count}`,
    ),
  );

  // The Aug-4 invariant: double-opt-in did NOT auto-confirm at signup time. If confirmed_at is set
  // before the click, the drip will treat this lead as opted-in and start sending immediately.
  steps.push(
    step(
      'confirmed_at is null (no auto-confirm)',
      postSignup.confirmed_at === null,
      `confirmed_at=${postSignup.confirmed_at ?? 'null'}`,
    ),
  );

  // The other Aug-4 invariant: converted_at is null (no premature buyer-suppression flip). This
  // is the DB proxy for "convertLead was NOT called during signup." convertLead is the ONLY code
  // path that flips this column AND pushes converted/member tags to GHL, so a null here proves
  // no premature GHL conversion tag fired.
  steps.push(
    step(
      'converted_at is null (convertLead NOT called at signup)',
      postSignup.converted_at === null,
      `converted_at=${postSignup.converted_at ?? 'null'}`,
    ),
  );

  // ---------- Phase 3: simulate the confirm-link click ----------
  if (!postSignup.confirm_token) {
    steps.push(step('confirmLeadByToken flipped confirmed_at', false, 'No confirm_token to click.'));
    revalidatePath('/admin/waitlist/suppression-qa');
    return { overall: 'fail', email, leadId, steps, startedAt, finishedAt: new Date().toISOString() };
  }
  try {
    const cRes = await confirmLeadByToken(postSignup.confirm_token);
    if (!cRes.ok) {
      steps.push(step('confirmLeadByToken flipped confirmed_at', false, 'confirmLeadByToken returned ok=false.'));
    } else {
      const postConfirm = await readQaLead(email);
      const flipped = Boolean(postConfirm?.confirmed_at);
      steps.push(
        step(
          'confirmLeadByToken flipped confirmed_at',
          flipped,
          `confirmed_at=${postConfirm?.confirmed_at ?? 'null'}`,
        ),
      );
      // Confirming a lead must NOT touch converted_at (still just an opt-in, not a purchase).
      steps.push(
        step(
          'converted_at still null after confirm',
          postConfirm?.converted_at === null,
          `converted_at=${postConfirm?.converted_at ?? 'null'}`,
        ),
      );
    }
  } catch (e: unknown) {
    steps.push(step('confirmLeadByToken flipped confirmed_at', false, e instanceof Error ? e.message : String(e)));
  }

  // ---------- Phase 4: simulate the Stripe checkout.session.completed webhook ----------
  try {
    const conv = await convertLead(email);
    if (!conv.found) {
      steps.push(step('convertLead flipped converted_at', false, 'convertLead returned found=false.'));
    } else {
      const postConvert = await readQaLead(email);
      const flipped = Boolean(postConvert?.converted_at);
      steps.push(
        step(
          'convertLead flipped converted_at',
          flipped,
          `converted_at=${postConvert?.converted_at ?? 'null'}`,
        ),
      );
    }
  } catch (e: unknown) {
    steps.push(step('convertLead flipped converted_at', false, e instanceof Error ? e.message : String(e)));
  }

  const overall: 'pass' | 'fail' = steps.every((s) => s.ok) ? 'pass' : 'fail';
  revalidatePath('/admin/waitlist/suppression-qa');
  return { overall, email, leadId, steps, startedAt, finishedAt: new Date().toISOString() };
}

export async function cleanupSuppressionQaAction(): Promise<CleanupResult> {
  const ctx = await requireOperator();
  if (!ctx.companyId) return { deleted: 0, error: 'no_company' };
  const allowed = await checkRateLimit(ctx.userId, `${RUN_BUCKET}-cleanup`, RUN_LIMIT, RUN_WINDOW_SEC);
  if (!allowed) return { deleted: 0, error: 'rate_limited' };
  const res = await deleteQaLeads();
  revalidatePath('/admin/waitlist/suppression-qa');
  return res;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
