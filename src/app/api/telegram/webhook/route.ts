// Telegram inbound webhook: the bot receives commands and button taps here.
//
// TWO INDEPENDENT GATES, because this endpoint is public by necessity (Telegram must reach it) and
// it reads member support data.
//
//   1. The secret header. Telegram echoes X-Telegram-Bot-Api-Secret-Token on every delivery, set
//      when the webhook is registered. A request without it is not from Telegram.
//   2. The chat id. @tnfsupportbot has a public username, so anyone can message it and Telegram
//      will faithfully forward that to us. Only TELEGRAM_CHAT_ID is served.
//
// Either gate alone would be a hole: the header proves the request came from Telegram, not that the
// SENDER is authorized. Both must pass.
//
// Unauthorized requests get 200 with an empty body, never 401. Telegram retries non-2xx, so an error
// status would put us in a retry loop over traffic we are deliberately ignoring, and a distinct
// status is itself a signal that something is here worth probing.
import { NextResponse, type NextRequest } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { safeEqual } from '@/lib/api/auth';
import { resolveTenantId } from '@/lib/tenant';
import { isAuthorizedChat, handleCommand, handleCallback } from '@/lib/support/telegram-commands';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Update = {
  message?: { chat?: { id?: number }; text?: string };
  callback_query?: { id?: string; data?: string; message?: { chat?: { id?: number } } };
};

const OK = NextResponse.json({ ok: true });

async function POST_h(req: NextRequest): Promise<Response> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return OK; // not configured: accept and ignore, never 500 at Telegram
  if (!safeEqual(req.headers.get('x-telegram-bot-api-secret-token'), secret)) return OK;

  const update = (await req.json().catch(() => null)) as Update | null;
  if (!update) return OK;

  try {
    const companyId = await resolveTenantId();

    if (update.callback_query?.id && update.callback_query.data) {
      if (!isAuthorizedChat(update.callback_query.message?.chat?.id)) return OK;
      await handleCallback(companyId, update.callback_query.id, update.callback_query.data);
      return OK;
    }

    const text = update.message?.text;
    if (text && isAuthorizedChat(update.message?.chat?.id)) {
      await handleCommand(companyId, text);
    }
  } catch (e) {
    // Swallow: a thrown error would make Telegram retry the same update forever.
    console.error('telegram webhook:', e instanceof Error ? e.message : e);
  }
  return OK;
}

export const POST = withApiLog(POST_h);
