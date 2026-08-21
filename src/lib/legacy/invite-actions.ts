'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { inviteLegacyClients } from '@/lib/legacy/invite';
import { logCoachAction } from '@/lib/coach/audit';

/**
 * Sending real email to real people, from a button.
 *
 * Everything here reaches a client's inbox, so the safety is deliberately layered rather than
 * trusted to the UI. A disabled button is a suggestion; these are the actual guarantees:
 *
 *   1. requireCoach. Not exported anywhere a member can reach.
 *   2. The batch will not exceed MAX_BATCH per call, whatever the form says.
 *   3. Confirmation is checked ON THE SERVER against the number of people it is about to email, so
 *      a mistyped or stale form cannot send to a larger set than the one that was confirmed.
 *   4. Every send is written to the coach audit log with who and how many.
 *
 * inviteLegacyClients does the rest: it only ever selects legacy CLIENT contacts in this company
 * who have an email and have never claimed an account, so none of these can reach a lead, another
 * tenant, or somebody who is already in the app.
 */

/**
 * The most anybody can email in one action.
 *
 * 50, not 272. Resend's own rate limits aside, a first batch is a deliverability experiment: send
 * fifty, watch the bounces and the opens, then send the rest. A button that fires 272 emails at a
 * cold domain is how a sending reputation dies on the day it matters most.
 */
const MAX_BATCH = 50;

export type InviteActionResult = {
  ok: boolean;
  /** How many emails actually went out. */
  sent: number;
  /** Attempted but rejected by the provider. */
  failed: number;
  message: string;
};

function originFromHeaders(h: Headers): string {
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'www.teamthickandfit.com';
  return `${proto}://${host}`;
}

/**
 * Invite ONE named person.
 *
 * The normal first move, and the one the old curl-only path made hardest: pick somebody, invite
 * her, watch it land. Everything else on this screen is for after that has worked once.
 */
export async function inviteOneAction(formData: FormData): Promise<InviteActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { ok: false, sent: 0, failed: 0, message: 'No email' };

  try {
    const ctx = await requireCoach();
    if (!ctx.companyId) return { ok: false, sent: 0, failed: 0, message: 'No company scope' };

    const origin = originFromHeaders(await headers());
    const res = await inviteLegacyClients(ctx.companyId, origin, { dryRun: false, email, limit: 1 });

    // total 0 means the address matched nobody the sender would accept: already claimed, not a
    // legacy client, or no longer in this company. Say that rather than reporting a silent success.
    if (res.total === 0) {
      return { ok: false, sent: 0, failed: 0, message: 'notFound' };
    }
    logCoachAction(createServiceClient(), {
      companyId: ctx.companyId,
      userId: ctx.userId,
      entityType: 'contact',
      entityId: email,
      action: 'invite',
      newState: { sent: res.sent, mode: 'single' },
    });
    revalidatePath('/coach/invites');
    return {
      ok: res.sent > 0,
      sent: res.sent,
      failed: res.sent > 0 ? 0 : 1,
      message: res.sent > 0 ? 'sent' : 'sendFailed',
    };
  } catch (e) {
    console.error('inviteOneAction:', e instanceof Error ? e.message : e);
    return { ok: false, sent: 0, failed: 0, message: 'error' };
  }
}

/**
 * Invite a batch.
 *
 * `confirm` must equal the number of people this will email. Checked here, against the count the
 * SERVER is about to act on, so a form left open while somebody else claimed an account cannot send
 * to a set larger than the one that was confirmed on screen.
 */
export async function inviteBatchAction(formData: FormData): Promise<InviteActionResult> {
  const requested = Number(formData.get('size') ?? 0);
  const confirm = String(formData.get('confirm') ?? '').trim();

  try {
    const ctx = await requireCoach();
    if (!ctx.companyId) return { ok: false, sent: 0, failed: 0, message: 'No company scope' };

    const size = Math.min(Math.max(Math.floor(requested), 1), MAX_BATCH);
    if (confirm !== String(size)) {
      return { ok: false, sent: 0, failed: 0, message: 'confirmMismatch' };
    }

    const origin = originFromHeaders(await headers());
    const res = await inviteLegacyClients(ctx.companyId, origin, { dryRun: false, limit: size });

    logCoachAction(createServiceClient(), {
      companyId: ctx.companyId,
      userId: ctx.userId,
      entityType: 'contact',
      entityId: `batch:${size}`,
      action: 'invite',
      newState: { requested: size, total: res.total, sent: res.sent, mode: 'batch' },
    });
    revalidatePath('/coach/invites');
    return {
      ok: res.sent > 0,
      sent: res.sent,
      failed: res.total - res.sent,
      message: res.sent > 0 ? 'sent' : 'sendFailed',
    };
  } catch (e) {
    console.error('inviteBatchAction:', e instanceof Error ? e.message : e);
    return { ok: false, sent: 0, failed: 0, message: 'error' };
  }
}
