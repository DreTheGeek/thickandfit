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
import { retrieveKnowledge, renderKnowledgeBlock } from '@/lib/coach-ai/knowledge';
import { SAFETY_CLAUSE_EN } from '@/lib/coach-ai/safety';
import { AI_MODELS } from '@/lib/ai/models';
import { aiConfigured, openChatStream } from '@/lib/ai/client';
import { logInference } from '@/lib/ai/inferences';

// Persona-strong, cheap model for the conversational coach (voice fidelity matters most here).
const CHAT_MODEL = AI_MODELS.chat;
// Bump when the persona/system prompt changes so replay/eval can group turns by prompt generation.
const PROMPT_VERSION = 'coach-chat.v1';

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
  return aiConfigured();
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
  '',
  // Centralized safety boundaries (shared with plan-gen via safety.ts) so the medical-claim line is
  // identical everywhere the coach speaks. Static, so it stays inside the cached persona part.
  SAFETY_CLAUSE_EN,
].join('\n');

const PERSONA_ES = [
  'Eres la entrenadora personal de fitness con IA dentro de la app Thick & Fit, con la voz alentadora,',
  'cálida y directa de la coach Stephanie. Entrenas a mujeres en entrenamiento, nutrición y hábitos.',
  '',
  'Voz y reglas:',
  '- Sé cálida, motivadora y directa. Celebra los logros. Nunca avergüences. Respuestas cortas y prácticas.',
  '- Responde en el idioma de la miembro. Si escribe en español, responde en español; si no, en inglés.',
  '- Basa cada afirmación en el contexto de la miembro y en los registros pasados relevantes de abajo. No inventes números, pesos ni registros.',
  '- Cuando se muestren recuerdos relevantes de la miembro, úsalos para recordar comidas y conversaciones pasadas con naturalidad; no los cites textualmente ni menciones "recuerdos".',
  '- Si falta algún dato (sin comidas o sin peso registrado), dilo con amabilidad e invítala a registrar.',
  '- No eres médica. Para temas médicos, lesiones, embarazo o trastornos alimenticios, recomienda',
  '  consultar a un profesional licenciado; nunca des diagnósticos ni recetas médicas.',
  '- Mantente en fitness, nutrición, entrenamiento, recuperación y motivación. Redirige lo fuera de tema.',
  '',
  // Same centralized safety boundaries as the EN persona (English instruction is fine; the model still
  // replies to the member in Spanish). Static, so it stays inside the cached persona part.
  SAFETY_CLAUSE_EN,
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
  knowledgeBlock: string,
  memoryBlock: string,
  locale: CoachLocale,
  history: { role: ChatRole; content: string }[],
  userMessage: string,
): ApiMessage[] {
  const es = locale === 'es';
  const contextHeader = es ? 'Contexto de la miembro (datos en vivo):' : 'Member context (live data):';

  // Dynamic per-member text part: the live context, then (when retrieval found anything) Stephanie's
  // documented method for this question, then the member's own most relevant past records. Both
  // blocks are '' when unkeyed or no hits, so this stays a clean single text part. Kept OUT of the
  // cached persona deliberately: knowledge varies per question, so caching it would defeat the cache.
  const dynamicText = [`${contextHeader}\n${contextBlock}`, knowledgeBlock || null, memoryBlock || null]
    .filter(Boolean)
    .join('\n\n');

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
  // Brand rule: member-facing copy never says "AI"/"IA" - this is Stephanie's coaching, her voice.
  return locale === 'es'
    ? 'Tu entrenadora todavia esta preparando esta parte. Vuelve pronto, estara lista en breve.'
    : 'Your coach is still getting this part ready. Check back soon, she will be with you shortly.';
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

  if (!aiConfigured()) {
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

  // RAG (Layer 4): recall the company's documented coaching knowledge (Stephanie's voice / method)
  // most relevant to this question, distinct from the member's own memories. Company-scoped via
  // match_coach_knowledge. Key-gated inside knowledge.ts: returns [] when unkeyed, so chat still works.
  const knowledge = await retrieveKnowledge(companyId, request.message, 5);
  const knowledgeBlock = renderKnowledgeBlock(knowledge, locale);

  const contextBlock = renderContextBlock(ctx);
  const messages = buildMessages(
    contextBlock,
    knowledgeBlock,
    memoryBlock,
    locale,
    ctx.recentMessages,
    request.message,
  );

  // Thin passthrough: the shared client owns auth/endpoint/error logging; the SSE parse loop,
  // persistence, and cache_control message shaping below stay exactly as they were.
  const t0 = Date.now();
  const upstream = await openChatStream({
    model: CHAT_MODEL,
    messages,
    traceFeature: 'chat',
    companyId,
    profileId,
    retrievalCount: memories.length + knowledge.length,
    // Hard cap on connect + stream. Without it the fetch carried NO signal, so a pre-stream hang
    // held the lambda until the route's maxDuration killed it (observed as a 504 in prod). 45s
    // leaves persist/trace headroom under the 60s route ceiling; replies stream in a few seconds.
    timeoutMs: 45_000,
  });
  if (!upstream || !upstream.body) {
    return { status: 'notConfigured', message: notConfiguredMessage(locale) };
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let assistantText = '';
  let buffer = '';
  let finished = false;

  // Persist + trace + close exactly once, AWAITED before close so the write cannot die with the
  // frozen lambda. Called from the [DONE] frame (the normal path), the reader-done branch, and the
  // error branch, whichever comes first.
  async function finish(controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> {
    if (finished) return;
    finished = true;
    // Single completion log per turn: proves the persist path ran (the P0 was this never firing).
    console.log(`[coach-chat] finish: ${assistantText.length} chars at ${Date.now() - t0}ms`);
    if (assistantText.trim()) {
      await persistMessage(companyId, profileId, 'assistant', assistantText.trim());
      // Provenance for the turn. rawOutput bounded; full history lives in coach_messages.
      await logInference({
        companyId,
        profileId,
        feature: 'coach-chat',
        model: CHAT_MODEL,
        promptVersion: PROMPT_VERSION,
        latencyMs: Date.now() - t0,
        status: 'ok',
        rawOutput: { text: assistantText.trim().slice(0, 8000) },
      });
    }
    try {
      controller.close();
    } catch {
      // Already closed/errored; the persist above is what matters.
    }
    void reader.cancel().catch(() => undefined);
  }

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) return;
      try {
        // LOOP until at least one chunk is enqueued or the stream finishes. THIS is the real P0
        // mechanism: a pull() that fulfills without enqueueing anything is never re-called when the
        // only pending consumer read predates it (the spec's pullAgain flag stays false), so any
        // frame that produces no delta - OpenRouter's ": OPENROUTER PROCESSING" keep-alives, the
        // final usage frame, a [DONE]-only chunk - deadlocked the stream. The lambda then sat until
        // maxDuration killed it and the persist below never ran (zero assistant rows in prod).
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            await finish(controller);
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          // OpenRouter streams Server-Sent Events: lines of "data: {json}\n\n".
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          let enqueued = false;
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') {
              // Terminal frame: persist + close HERE. Waiting for the upstream socket close instead
              // does not work inside the lambda (it never surfaces).
              await finish(controller);
              return;
            }
            try {
              const json = JSON.parse(payload) as {
                choices?: { delta?: { content?: string } }[];
              };
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                assistantText += delta;
                controller.enqueue(encoder.encode(delta));
                enqueued = true;
              }
            } catch {
              // Ignore keep-alive comments / partial frames; the loop continues the buffer.
            }
          }
          // Progress made: hand control back; the runtime re-pulls as the consumer drains.
          if (enqueued) return;
        }
      } catch {
        // Upstream read failure / 45s cap: persist whatever we have, then end the stream cleanly.
        await finish(controller);
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return { status: 'ok', stream };
}
