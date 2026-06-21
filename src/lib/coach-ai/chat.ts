// The subscriber AI coach chat brain. Server-only.
// Composes the system prompt (a static, prompt-cacheable persona + the live context block),
// calls claude-haiku-4-5 through the OpenRouter pattern (same as overload/explain.ts and
// nutrition/photo.ts), and STREAMS the reply. Persistence of both the user turn and the
// assistant turn lives in coach_messages.
//
// Key-gating: if OPENROUTER_API_KEY is absent, callers get a clean "not configured" state.
// This module never throws on a missing key; the route returns HTTP 200 with a clear body.
import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { buildCoachContext, renderContextBlock, type CoachLocale } from '@/lib/coach-ai/context';
import { embedText, retrieveMemories, renderMemoryBlock } from '@/lib/coach-ai/embeddings';

const apiKey = process.env.OPENROUTER_API_KEY;

// Fast + cheap model for the conversational coach. Volume tier per the project AI router.
const CHAT_MODEL = 'anthropic/claude-haiku-4-5';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// How many recent turns to replay into the model. Context already includes the last 7 days of
// chat in its summary, but we replay the most recent turns verbatim for conversational coherence.
const HISTORY_TURNS = 12;
const MAX_MESSAGE_LEN = 2000;

export type ChatRole = 'user' | 'assistant';

// --- Validation -------------------------------------------------------------
export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LEN),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export function isConfigured(): boolean {
  return Boolean(apiKey);
}

// --- Persona (STATIC, prompt-cacheable) -------------------------------------
// This is the default bilingual fitness-coach voice. The persona Knowledge Base is pending
// (Gap Log 5); when it lands, swap PERSONA_EN / PERSONA_ES for the real voice. Keeping this
// block static (no per-request interpolation) lets OpenRouter/Anthropic cache it across turns.
const PERSONA_EN = [
  'You are the personal AI fitness coach inside the Thick & Fit app, speaking in the encouraging,',
  'warm, no-nonsense voice of coach Stephanie. You coach women on training, nutrition, and habits.',
  '',
  'Voice and rules:',
  '- Be warm, motivating, and direct. Celebrate wins. Never shame. Keep replies short and practical.',
  '- Answer in the member\'s language. If they write in Spanish, reply in Spanish; otherwise English.',
  '- Ground every claim in the member context and any relevant past records provided below. Do not invent numbers, weights, or logs.',
  '- When relevant member memories are shown, use them to recall past meals and conversations naturally; do not quote them verbatim or mention "memories".',
  '- If the context is empty for something (no food logged, no weight), say so kindly and nudge them to log.',
  '- You are not a doctor. For medical, injury, pregnancy, or eating-disorder concerns, recommend they',
  '  consult a licensed professional, and never give medical diagnoses or prescriptions.',
  '- Stay on fitness, nutrition, training, recovery, and motivation. Politely redirect off-topic asks.',
].join('\n');

const PERSONA_ES = [
  'Eres la entrenadora personal de fitness con IA dentro de la app Thick & Fit, con la voz alentadora,',
  'calida y directa de la coach Stephanie. Entrenas a mujeres en entrenamiento, nutricion y habitos.',
  '',
  'Voz y reglas:',
  '- Se calida, motivadora y directa. Celebra los logros. Nunca avergUences. Respuestas cortas y practicas.',
  '- Responde en el idioma de la miembro. Si escribe en espanol, responde en espanol; si no, en ingles.',
  '- Basa cada afirmacion en el contexto de la miembro y en los registros pasados relevantes de abajo. No inventes numeros, pesos ni registros.',
  '- Cuando se muestren recuerdos relevantes de la miembro, usalos para recordar comidas y conversaciones pasadas con naturalidad; no los cites textualmente ni menciones "recuerdos".',
  '- Si falta algun dato (sin comidas o sin peso registrado), dilo con amabilidad e invitala a registrar.',
  '- No eres medica. Para temas medicos, lesiones, embarazo o trastornos alimenticios, recomienda',
  '  consultar a un profesional licenciado; nunca des diagnosticos ni recetas medicas.',
  '- Mantente en fitness, nutricion, entrenamiento, recuperacion y motivacion. Redirige lo fuera de tema.',
].join('\n');

function persona(locale: CoachLocale): string {
  return locale === 'es' ? PERSONA_ES : PERSONA_EN;
}

// --- Message assembly -------------------------------------------------------
type ApiMessage =
  | { role: 'system'; content: { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[] }
  | { role: ChatRole; content: string };

// Build the message array for the model. The system message is split into a STATIC persona part
// (marked for prompt caching) and a dynamic context part (the live member data).
function buildMessages(
  contextBlock: string,
  memoryBlock: string,
  locale: CoachLocale,
  history: { role: ChatRole; content: string }[],
  userMessage: string,
): ApiMessage[] {
  const es = locale === 'es';
  const contextHeader = es ? 'Contexto de la miembro (datos en vivo):' : 'Member context (live data):';

  // Dynamic per-member text part: the live context, plus (when RAG found anything) the most
  // relevant past records for this question. memoryBlock is '' when unkeyed or no hits.
  const dynamicText = memoryBlock
    ? `${contextHeader}\n${contextBlock}\n\n${memoryBlock}`
    : `${contextHeader}\n${contextBlock}`;

  const system: ApiMessage = {
    role: 'system',
    content: [
      // Static persona: cache this across turns. Anthropic/OpenRouter honors cache_control.
      { type: 'text', text: persona(locale), cache_control: { type: 'ephemeral' } },
      // Dynamic per-member context + retrieved memories: not cached (changes per member / question).
      { type: 'text', text: dynamicText },
    ],
  };

  const turns: ApiMessage[] = history
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content }));

  return [system, ...turns, { role: 'user', content: userMessage }];
}

// --- Persistence ------------------------------------------------------------
async function persistMessage(
  companyId: string,
  profileId: string,
  role: ChatRole,
  content: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb.from('coach_messages').insert({
    company_id: companyId,
    profile_id: profileId,
    role,
    content,
  });
}

// --- History fetch ----------------------------------------------------------
export type StoredMessage = { id: string; role: ChatRole; content: string; createdAt: string };

export async function fetchHistory(profileId: string, limit = 50): Promise<StoredMessage[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('coach_messages')
    .select('id, role, content, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return ((data ?? []) as { id: string; role: ChatRole; content: string; created_at: string }[]).map(
    (r) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.created_at }),
  );
}

// --- Streaming chat ---------------------------------------------------------
export type ChatStreamResult =
  | { status: 'notConfigured'; message: string }
  | { status: 'ok'; stream: ReadableStream<Uint8Array> };

// The graceful "coach not configured" copy, in the member's language. Returned (HTTP 200) when
// no API key is present so the UI shows a clear state instead of an error.
export function notConfiguredMessage(locale: CoachLocale): string {
  return locale === 'es'
    ? 'Tu entrenadora con IA todavia no esta configurada. Vuelve pronto, estara lista en breve.'
    : 'Your AI coach is not configured yet. Check back soon, she will be ready shortly.';
}

// Runs a chat turn. Persists the user message immediately, then streams the assistant reply,
// accumulating it so the full text is persisted to coach_messages when the stream ends.
// The returned stream emits plain UTF-8 text chunks (the assistant's words), suitable for
// progressive rendering in the client.
export async function streamChat(
  profileId: string,
  companyId: string,
  request: ChatRequest,
): Promise<ChatStreamResult> {
  const ctx = await buildCoachContext(profileId, companyId);
  const locale = ctx.profile.locale;

  if (!apiKey) {
    return { status: 'notConfigured', message: notConfiguredMessage(locale) };
  }

  // Persist the user's turn first so it is never lost, even if the model call fails.
  await persistMessage(companyId, profileId, 'user', request.message);

  // RAG (Layer 3): embed the question and recall this member's most relevant past records
  // (their own coach_messages + embedded food_log day summaries), then inject the top 5 into the
  // context. Fully key-gated inside embeddings.ts: returns [] when unkeyed, so chat works without it.
  const queryVec = await embedText(request.message);
  const memories = queryVec ? await retrieveMemories(profileId, queryVec, 5) : [];
  const memoryBlock = renderMemoryBlock(memories, locale);

  const contextBlock = renderContextBlock(ctx);
  const messages = buildMessages(contextBlock, memoryBlock, locale, ctx.recentMessages, request.message);

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: CHAT_MODEL, stream: true, messages }),
    });
  } catch {
    return { status: 'notConfigured', message: notConfiguredMessage(locale) };
  }

  if (!upstream.ok || !upstream.body) {
    return { status: 'notConfigured', message: notConfiguredMessage(locale) };
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let assistantText = '';
  let buffer = '';

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          // Persist the assembled assistant reply (fire-and-forget; do not block the close).
          if (assistantText.trim()) {
            void persistMessage(companyId, profileId, 'assistant', assistantText.trim());
          }
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        // OpenRouter streams Server-Sent Events: lines of "data: {json}\n\n".
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload) as {
              choices?: { delta?: { content?: string } }[];
            };
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              controller.enqueue(encoder.encode(delta));
            }
          } catch {
            // Ignore keep-alive comments / partial frames; the next pull continues the buffer.
          }
        }
      } catch {
        // Upstream read failure: persist whatever we have, then end the stream cleanly.
        if (assistantText.trim()) {
          void persistMessage(companyId, profileId, 'assistant', assistantText.trim());
        }
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return { status: 'ok', stream };
}
