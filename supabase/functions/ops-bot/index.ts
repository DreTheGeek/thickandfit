// The ops bot, running entirely inside Supabase.
//
// Two endpoints, two different callers, two different gates:
//
//   POST|GET /ops-bot/recap    <- pg_cron. Bearer CRON_SECRET. Sends the 9pm ET digest.
//   POST     /ops-bot/webhook  <- Telegram. Secret header + chat id. Answers commands and taps.
//
// Deployed with --no-verify-jwt, because Telegram cannot present a Supabase JWT. That is safe only
// because each route authenticates itself; do not add a route here that skips that step.
//
// WHY IT MOVED OFF VERCEL. On 2026-08-01 Vercel soft-blocked the project for a fluid-compute
// overage. pg_cron fired 60 times and every call came back 402, so the recap never sent and
// `cron_job_log` stayed empty (the route that writes it never ran). The bot went quiet at exactly
// the moment something was wrong. Postgres and api.telegram.org are all this needs, so it now
// depends on neither the app nor its hosting.
import { serviceClient } from '../_shared/api.ts';
import { isAuthorizedChat, safeEqual, telegramConfigured } from './telegram.ts';
import { handleCommand, handleCallback } from './commands.ts';
import { sendDailyRecap, etDayBounds } from './recap.ts';

const TENANT_SLUG = 'thick-and-fit';
const SEND_AT_ET_HOUR = 21;

type Update = {
  message?: { chat?: { id?: number }; text?: string };
  callback_query?: { id?: string; data?: string; message?: { chat?: { id?: number } } };
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// deno-lint-ignore no-explicit-any
async function resolveTenantId(svc: any): Promise<string> {
  const { data } = await svc.from('companies').select('id').eq('slug', TENANT_SLUG).maybeSingle();
  if (!data) throw new Error('tenant: not configured');
  return data.id as string;
}

/**
 * Audit every run, loudly on failure.
 *
 * This insert used to happen inside the Vercel route, which is why the August 1 outage left no
 * trace: the thing that records the failure was downstream of the failure. Writing it here means a
 * run is logged even when everything outside Postgres is unreachable.
 */
// deno-lint-ignore no-explicit-any
async function logCronRun(svc: any, jobName: string, status: string, detail: unknown): Promise<void> {
  try {
    const { error } = await svc.from('cron_job_log').insert({ job_name: jobName, status, detail: detail ?? null });
    if (error) console.error(`[cron_job_log] ${jobName} insert failed: ${error.message}`);
  } catch (e) {
    console.error(`[cron_job_log] ${jobName} insert threw:`, e instanceof Error ? e.message : e);
  }
}

/**
 * The recap. FIRES TWICE, SENDS ONCE.
 *
 * pg_cron schedules in UTC and 9pm ET is 01:00 UTC in summer, 02:00 UTC in winter. Rather than
 * hardcode one and be an hour wrong for half the year, both are scheduled and this sends only when
 * the ET wall clock actually reads 21. `?force=1` bypasses the gate for manual testing.
 */
async function handleRecap(req: Request): Promise<Response> {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || !safeEqual(req.headers.get('authorization'), `Bearer ${secret}`)) {
    return json({ error: 'unauthorized' }, 401);
  }

  const svc = serviceClient();
  const now = new Date();
  const { etHour, etDate } = etDayBounds(now);
  const force = new URL(req.url).searchParams.get('force') === '1';

  if (!force && etHour !== SEND_AT_ET_HOUR) {
    // The expected outcome for the twin that is not in season. Logged as success: a skip is the job
    // working, and marking it an error would make /health cry wolf once a day forever.
    const skipped = { ok: true, skipped: true, etHour, etDate };
    await logCronRun(svc, 'daily-recap-cron', 'success', skipped);
    return json(skipped);
  }

  const companyId = await resolveTenantId(svc);
  const result = await sendDailyRecap(svc, companyId, now);
  await logCronRun(svc, 'daily-recap-cron', result.ok ? 'success' : 'error', result);
  return json(result, result.ok ? 200 : 500);
}

/**
 * Telegram inbound. TWO INDEPENDENT GATES, because this endpoint is public by necessity and it reads
 * member support data.
 *
 *   1. The secret header Telegram echoes on every delivery, set when the webhook was registered. A
 *      request without it is not from Telegram.
 *   2. The chat id. @tnfsupportbot has a public username, so anyone can message it and Telegram will
 *      faithfully forward that to us. Only TELEGRAM_CHAT_ID is served.
 *
 * Either alone is a hole: the header proves the request came from Telegram, not that the SENDER is
 * authorized.
 *
 * Everything returns 200, never 401. Telegram retries non-2xx, so an error status would put us in a
 * retry loop over traffic we are deliberately ignoring, and a distinct status is itself a signal that
 * something here is worth probing.
 */
async function handleWebhook(req: Request): Promise<Response> {
  const ok = json({ ok: true });
  const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
  if (!secret) return ok; // not configured: accept and ignore, never 500 at Telegram
  if (!safeEqual(req.headers.get('x-telegram-bot-api-secret-token'), secret)) return ok;

  const update = (await req.json().catch(() => null)) as Update | null;
  if (!update) return ok;

  try {
    const svc = serviceClient();

    // BOOTSTRAP. TELEGRAM_CHAT_ID cannot be read back out of Vercel (encrypted) and the Bot API has
    // no method to list the chats a bot belongs to, so a migration between hosts has no way to carry
    // it across. Until the secret is set, record the chat id of a genuine Telegram delivery so it can
    // be read out of the database and configured once.
    //
    // This does NOT weaken the chat lock. The secret header has already been verified above, so the
    // delivery provably came from Telegram; nothing is replied to, nothing is looked up, and nothing
    // is acted on. The only effect is one audit row. Once TELEGRAM_CHAT_ID is set this branch is
    // dead and every unauthorized chat is ignored exactly as before.
    if (!Deno.env.get('TELEGRAM_CHAT_ID')) {
      const chat = update.message?.chat ?? update.callback_query?.message?.chat;
      await logCronRun(svc, 'telegram-bootstrap', 'success', {
        chat_id: chat?.id ?? null,
        note: 'TELEGRAM_CHAT_ID is not set on this function; no command was executed.',
      });
      return ok;
    }

    const companyId = await resolveTenantId(svc);

    if (update.callback_query?.id && update.callback_query.data) {
      if (!isAuthorizedChat(update.callback_query.message?.chat?.id)) return ok;
      await handleCallback(svc, companyId, update.callback_query.id, update.callback_query.data);
      return ok;
    }

    const text = update.message?.text;
    if (text && isAuthorizedChat(update.message?.chat?.id)) {
      await handleCommand(svc, companyId, text);
    }
  } catch (e) {
    // Swallow: a thrown error would make Telegram retry the same update forever.
    console.error('telegram webhook:', e instanceof Error ? e.message : e);
  }
  return ok;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Supabase serves this at /functions/v1/ops-bot/<action>; the last segment is the action.
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  const action = path.slice(path.lastIndexOf('/') + 1);

  try {
    if (action === 'recap') return await handleRecap(req);
    if (action === 'webhook') return await handleWebhook(req);
    // Cheap liveness for a human with curl. Deliberately says nothing about configuration beyond
    // whether the bot could speak at all, since this route has no authentication.
    if (action === 'ping') return json({ ok: true, telegram: telegramConfigured() });
    return json({ error: 'not found' }, 404);
  } catch (e) {
    console.error('ops-bot:', e instanceof Error ? e.message : e);
    return json({ error: 'internal' }, 500);
  }
});
