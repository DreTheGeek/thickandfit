# WP3 finish: AI knowledge builder + plan-gen + safety - Research

**Researched:** 2026-06-28
**Domain:** RAG knowledge ingestion, structured LLM generation, AI safety guardrails (Next.js 16 RSC + Supabase pgvector + OpenRouter)
**Confidence:** HIGH (every claim below is grounded in files I read in this repo or the cloned ai-junkies reference; external claims cited)

## Summary

WP3 already ships a complete, key-gated AI coach: streaming chat (`src/lib/coach-ai/chat.ts`), nightly Sonnet insights (`src/lib/coach-ai/insights.ts`), and a Layer-3 RAG layer over the member's *own* records (`src/lib/coach-ai/embeddings.ts` + `match_coach_memory` RPC from migration `0030`). The three remaining pieces all bolt onto patterns that already exist in this exact codebase, so this is overwhelmingly an *assembly* job, not a research-into-the-unknown job.

The single most important architectural fact: the coach's system prompt is assembled in `chat.ts > buildMessages()` from a **static persona** (`PERSONA_EN`/`PERSONA_ES`, marked `cache_control: ephemeral`) plus a **dynamic context block** (`renderContextBlock(ctx)`) plus an optional **memory block** (`renderMemoryBlock(memories, locale)`). The Knowledge Builder feeds a *fourth* block into this same assembly: a company-scoped (Stephanie's voice/method) retrieval, distinct from the per-member memory. Comment lines 38-41 in `chat.ts` literally call this out as the planned swap point ("The persona Knowledge Base is pending (Gap Log 5); when it lands, swap PERSONA_EN / PERSONA_ES for the real voice"). Plan-gen reuses the exact `extractNarrative()` JSON-mode pattern from `insights.ts` (Sonnet via OpenRouter `response_format: json_object`). Safety reuses the existing persona medical-disclaimer rules plus the `/disclaimer` + `health_ack_at` gate (migration `0038`).

The embedding stack is fixed and proven: `openai/text-embedding-3-small` at **1536 dims** via OpenRouter's `/embeddings` endpoint, stored in `vector(1536)` columns with **HNSW `vector_cosine_ops`** indexes. `coach_knowledge` must match this exactly or `match_*` RPCs break.

**Primary recommendation:** Add ONE migration (`0039_coach_knowledge.sql`) creating a company-scoped `coach_knowledge` table (`vector(1536)`, HNSW, RLS coach-write/coach+subscriber-read) + a `match_coach_knowledge(p_company_id, query_embedding, match_count)` RPC mirroring `match_coach_memory`. Add `src/lib/coach-ai/knowledge.ts` (chunk + embed + retrieve, reusing `embedText`/`toVectorLiteral`/`chunkByParagraph`). Wire a `renderKnowledgeBlock()` into `buildCoachContext`/`streamChat`. Add `src/lib/coach-ai/plan-gen.ts` (Sonnet JSON-mode generation mapped to `meal_plans.plan_jsonb` / `plans`+`session_exercises`). Add a coach page under `src/app/(app)/coach/settings/knowledge/`. Reinforce the existing disclaimer rule in the persona and add a one-time bilingual in-chat AI disclaimer banner.

---

## Standard Stack (already in this repo - DO NOT introduce alternatives)

### Core
| Library / primitive | Version / id | Purpose | Why it is the standard here |
|---|---|---|---|
| OpenRouter chat | `anthropic/claude-haiku-4-5` (chat), `anthropic/claude-sonnet-4-6` (batch/gen) | LLM calls | Already the wired pattern in `chat.ts` (volume tier) + `insights.ts` (quality tier). Plan-gen is low-volume -> Sonnet. |
| OpenRouter embeddings | `openai/text-embedding-3-small`, 1536 dims | text -> vector | `src/lib/coach-ai/embeddings.ts` exports `EMBED_MODEL` + `EMBED_DIMS = 1536`. Confirmed default dims for this model. |
| pgvector | `vector(1536)` columns + HNSW `vector_cosine_ops` | similarity search | Every embedding column in the DB (`coach_messages`, `food_log`, `foods`) uses HNSW cosine. |
| Supabase service client | `createServiceClient()` | server-only DB access | Single-tenant + service-client-everywhere is the project rule; the route authorizes, the lib uses service. |
| Zod | (project dep) | input validation | Mandatory on every action/route per CLAUDE.md; `chatRequestSchema` is the template. |
| DB rate limiter | `checkRateLimit()` | bound OpenRouter spend | `src/lib/security/rate-limit.ts`, already applied to `coach-ai/chat`. New ingest/gen endpoints MUST use it. |

### Supporting (copy these patterns verbatim)
| Source file | What to reuse |
|---|---|
| `src/lib/coach-ai/embeddings.ts` | `embedText()` (key-gated, returns null when no key, asserts 1536 dims), `toVectorLiteral()`, `retrieveMemories()` shape, `renderMemoryBlock()` shape. |
| `src/lib/coach-ai/chat.ts` | `buildMessages()` (system = persona[cached] + dynamic blocks), the OpenRouter streaming SSE reader, `notConfiguredMessage()` degradation. |
| `src/lib/coach-ai/insights.ts` | `extractNarrative()` (Sonnet, `response_format:{type:'json_object'}`, `parseNarrative()` defensive coercion), `logUsage()` -> `ai_usage_log`. This is the plan-gen template. |
| `src/lib/community/challenge-actions.ts` | The canonical `'use server'` + Zod + `requireCoach()` + insert + `revalidatePath` server-action shape. |
| `C:/Users/dre/ai-junkies-ref/src/lib/ai/chunking.ts` | `chunkByParagraph(text)` - ~500-token chunks, ~50-token overlap, paragraph-boundary split. Pure function, copy directly. |

### Alternatives explicitly NOT to use
| Tempting alternative | Why reject |
|---|---|
| LangChain / LlamaIndex / a vector-DB SDK | The whole RAG stack is ~120 lines of hand-rolled-but-proven code already. Adding a framework breaks the key-gated/never-throws contract. |
| A new embedding model (Gemini, voyage) | Mixing dims/models across `coach_knowledge` and `coach_messages` makes a unified retrieval impossible and breaks the 1536 assertion. Stay on `text-embedding-3-small`. |
| Storing knowledge in `meal_plans.plan_jsonb` Lenus blob | That column is the imported Lenus GraphQL shape (`mealGroups`/`macroTiming`/`__typename`). Do not overload it; plan-gen *writes* a compatible subset, knowledge gets its own table. |

**No install needed** - every dependency is already in the repo.

---

## Architecture Patterns

### Where each piece lives
```
supabase/migrations/
  0039_coach_knowledge.sql        # NEW: coach_knowledge table + match_coach_knowledge RPC

src/lib/coach-ai/
  knowledge.ts                    # NEW: chunkText + ingestKnowledge + retrieveKnowledge + renderKnowledgeBlock
  plan-gen.ts                     # NEW: generateMealPlan / generateProgram (Sonnet JSON-mode -> meal_plans/plans)
  context.ts                      # EDIT: optionally include a company-knowledge summary (or leave to chat.ts)
  chat.ts                         # EDIT: retrieve + inject knowledge block into buildMessages()
  safety.ts                       # NEW (small): shared medical-claim guardrail strings + disclaimer copy

src/app/(app)/coach/settings/knowledge/
  page.tsx                        # NEW: coach Knowledge Builder (RSC list + paste form)
  knowledge-actions.ts            # NEW: 'use server' ingestKnowledgeAction / deleteKnowledgeAction (requireCoach)

src/app/api/coach-ai/
  plan/route.ts                   # NEW (optional): POST generate-plan, rate-limited, requireCoach via resolveAuth

src/components/coach-ai/
  coach-chat.tsx                  # EDIT: render the one-time AI safety disclaimer banner
```

### Pattern 1: Knowledge Builder = company-scoped twin of `match_coach_memory`
**What:** A coach pastes Stephanie's voice/method/FAQs as text; we chunk -> embed each chunk -> store in `coach_knowledge` (company-scoped, NOT profile-scoped). At chat time we embed the member's question and retrieve the top-K knowledge chunks for *the company*, then inject them as a distinct system block. This grounds answers in her actual method, separate from the member's personal history.

**Why this shape:** `match_coach_memory` (migration `0030`, lines 38-83) is per-`profile_id`. Knowledge is per-`company_id` (Stephanie's brain, shared across all members). Same SECURITY DEFINER + cosine + HNSW recipe, different scope key.

**SQL sketch (migration `0039_coach_knowledge.sql`):**
```sql
-- 0039 PHASE 2 - Coach knowledge base. Stephanie's voice/method/FAQ text, chunked + embedded,
-- company-scoped (shared across all her members), retrieved into the coach system prompt.
-- Mirrors coach_messages (0028) for the embedding/index, and match_coach_memory (0030) for recall,
-- but keyed on company_id instead of profile_id. 0038 is taken, so this is 0039.

create extension if not exists vector;

create table if not exists public.coach_knowledge (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,                         -- tenant scope (Stephanie = tenant 1)
  source_id uuid not null default gen_random_uuid(),-- groups chunks from one paste/document
  title text,                                       -- human label for the source document
  chunk_index int not null default 0,               -- order within the source
  content text not null,                            -- the chunk text (also injected verbatim)
  embedding vector(1536),                           -- text-embedding-3-small; null when AI not configured
  created_by uuid,                                  -- coach profile id who ingested
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coach_knowledge_company on public.coach_knowledge (company_id, source_id);
create index if not exists idx_coach_knowledge_embedding
  on public.coach_knowledge using hnsw (embedding vector_cosine_ops);

alter table public.coach_knowledge enable row level security;
-- Coaches manage it; subscribers in the same company may READ (the chat lib runs service-side anyway,
-- but the read grant lets future client reads work and documents intent). Mirrors the owner-or-coach
-- idiom but with company read for subscribers.
drop policy if exists coach_knowledge_rw on public.coach_knowledge;
create policy coach_knowledge_rw on public.coach_knowledge for all
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
drop policy if exists coach_knowledge_read on public.coach_knowledge;
create policy coach_knowledge_read on public.coach_knowledge for select
  using (company_id = public.current_company_id());

-- Recall: top-N knowledge chunks for one company nearest to query_embedding. SECURITY DEFINER +
-- explicit company filter (the calling route/lib authorizes the company). Mirrors match_coach_memory.
create or replace function public.match_coach_knowledge(
  p_company_id uuid,
  query_embedding vector(1536),
  match_count int default 5
)
returns table (id uuid, title text, content text, similarity double precision)
language sql stable security definer set search_path = public
as $$
  select k.id, k.title, k.content, 1 - (k.embedding <=> query_embedding) as similarity
  from public.coach_knowledge k
  where k.company_id = p_company_id and k.embedding is not null
  order by k.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.match_coach_knowledge(uuid, vector, int) from public;
grant execute on function public.match_coach_knowledge(uuid, vector, int) to authenticated, service_role;
```

**Lib sketch (`src/lib/coach-ai/knowledge.ts`):**
```ts
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { embedText, toVectorLiteral, embeddingsConfigured } from '@/lib/coach-ai/embeddings';

// Copy chunkByParagraph from ai-junkies-ref/src/lib/ai/chunking.ts (pure, ~500-tok chunks, ~50 overlap).
export function chunkKnowledge(text: string): string[] { /* paragraph split + merge to ~2000 chars */ }

// Ingest one pasted document: chunk -> embed each -> insert rows under one source_id. Key-gated:
// when embeddingsConfigured() is false, store chunks with embedding null (still readable; just no RAG).
export async function ingestKnowledge(
  companyId: string, createdBy: string, title: string, text: string,
): Promise<{ sourceId: string; chunks: number; embedded: number }> {
  const sb = createServiceClient();
  const sourceId = crypto.randomUUID();
  const chunks = chunkKnowledge(text);
  let embedded = 0;
  const rows = [];
  for (let i = 0; i < chunks.length; i++) {
    const vec = await embedText(chunks[i]);          // null when no key; failures degrade
    if (vec) embedded++;
    rows.push({ company_id: companyId, source_id: sourceId, title, chunk_index: i,
      content: chunks[i], embedding: vec ? toVectorLiteral(vec) : null, created_by: createdBy });
  }
  if (rows.length) await sb.from('coach_knowledge').insert(rows);
  return { sourceId, chunks: chunks.length, embedded };
}

export type KnowledgeHit = { title: string | null; content: string; similarity: number };
export async function retrieveKnowledge(companyId: string, question: string, limit = 5): Promise<KnowledgeHit[]> {
  const vec = await embedText(question);
  if (!vec) return [];
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('match_coach_knowledge', {
    p_company_id: companyId, query_embedding: toVectorLiteral(vec), match_count: limit,
  });
  if (error || !Array.isArray(data)) return [];
  return (data as KnowledgeHit[]).filter((h) => (h.content ?? '').trim());
}

export function renderKnowledgeBlock(hits: KnowledgeHit[], locale: 'en' | 'es'): string {
  if (!hits.length) return '';
  const header = locale === 'es'
    ? "Metodo y voz de la coach Stephanie (usa esto como tu fuente de verdad):"
    : "Coach Stephanie's method and voice (use this as your source of truth):";
  return [header, ...hits.map((h) => `- ${h.content.length > 400 ? h.content.slice(0, 397) + '...' : h.content}`)].join('\n');
}
```

**Wiring into chat (`src/lib/coach-ai/chat.ts`):** in `streamChat`, after the existing `memories` retrieval, add:
```ts
const knowledge = await retrieveKnowledge(companyId, request.message, 5);
const knowledgeBlock = renderKnowledgeBlock(knowledge, locale);
```
and pass `knowledgeBlock` into `buildMessages`, appending it to `dynamicText` (or, better, as a SECOND cached system text part since company knowledge is stable across members - though it varies by question via retrieval, so keep it in the dynamic part next to the memory block).

### Pattern 2: Plan-gen = `extractNarrative()` reshaped for generation
**What:** Given a client's `onboarding_responses` (answers + predicted_goal + computed_targets) plus retrieved knowledge, call Sonnet in JSON mode to produce a structured plan, then insert into the existing tables. Two flavors:
- **Meal plan** -> `meal_plans` row. Typed columns: `name`, `calorie_goal`, `protein_g`, `carb_g`, `fat_g`, `split_protein_pct/carb_pct/fat_pct`, `macro_timing_name`, `num_meal_groups`, `is_template`, `contact_id` (nullable), plus a `plan_jsonb` blob. Map AI output onto the typed columns; put the meal/day breakdown into `plan_jsonb` using a SUBSET of the Lenus shape (`{ name, mealGroups: [{ name, numberOfMeals }], ... }`) so the existing `getMealPlanDetail` reader (`src/lib/coach/meal-plans.ts` lines 95-104) parses it.
- **Workout program** -> `plans` row (`name_en`, `name_es`, `weeks`, `is_template`, `created_by`) + child `session_exercises` (`session_id`, `exercise_id`, `format`, `sets`, `reps`, `time_sec`, `rest_sec`, `rounds`, `sort_order`). NOTE: there is NO `programs` table; the program/workout-plan table is `plans` (confirmed via information_schema). Generating real sessions requires resolving `exercise_id` against the `exercises` library, which is non-trivial - see Open Questions.

**Why this shape:** `insights.ts > extractNarrative()` (lines 366-398) already does Sonnet + `response_format: json_object` + defensive `parseNarrative()`. Plan-gen is the same call with a generation prompt and a plan schema. `logUsage()` (lines 402-413) already meters into `ai_usage_log` - reuse it.

**Prompt + output sketch (`src/lib/coach-ai/plan-gen.ts`):**
```ts
const PLAN_MODEL = 'anthropic/claude-sonnet-4-6';
const MEAL_PLAN_SYSTEM = [
  'You are coach Stephanie\'s meal-planning assistant for a bilingual fitness app.',
  'Given a member intake + her coaching method (knowledge), produce a structured meal plan.',
  'Return ONLY minified JSON of this exact shape, no prose, no markdown fences:',
  '{"name":string,"calorie_goal":int,"protein_g":int,"carb_g":int,"fat_g":int,',
  '"split_protein_pct":int,"split_carb_pct":int,"split_fat_pct":int,"macro_timing_name":string,',
  '"meal_groups":[{"name":string,"number_of_meals":int,"example_items":[string]}]}',
  'Macros must sum sensibly to the calorie goal (4/4/9 kcal per g). Honor the member computed_targets',
  'when present. Keep meal_groups to 3-5. Ground choices in the coaching method provided.',
].join('\n');
```
Then `JSON.parse` + clamp/coerce (copy `parseNarrative`'s discipline), map to columns, build `plan_jsonb` = `{ name, mealGroups: groups.map(g => ({ name: g.name, numberOfMeals: g.number_of_meals })), generated_by: 'ai' }`, and `insert` into `meal_plans` with `company_id`, `is_template: false`, `contact_id` (the client's contact if known else null). Validate the parsed object with a Zod schema before insert.

### Pattern 3: AI safety = reinforce existing persona + add an in-chat disclaimer + reuse the `/disclaimer` gate
**What:** Three layers, none new infrastructure:
1. **Already present** (lines 51-54 of `chat.ts` `PERSONA_EN`, 67-69 `PERSONA_ES`): "You are not a doctor... never give medical diagnoses or prescriptions... redirect off-topic." Strengthen this into an explicit, numbered safety clause and append the same clause to the plan-gen system prompt so generated plans carry a "consult a professional for medical conditions" caveat.
2. **In-chat one-time disclaimer banner** in `src/components/coach-ai/coach-chat.tsx`: a bilingual notice that the coach is an AI, not a medical professional. Pair with the existing `/disclaimer` + `health_ack_at` (migration `0038`) gate - members already accept assumption-of-risk before any training content via `requireEntitled()` (`src/lib/auth/guards.ts` line 27). The AI banner is informational and consistent with `/disclaimer` copy; it does not need a second DB ack (the `health_ack_at` ack already covers training/nutrition guidance). If product wants a separate AI-specific ack, add a `coach_ai_ack_at timestamptz` column - flagged as an Open Question.
3. **Guardrail string module** `src/lib/coach-ai/safety.ts`: export the bilingual disclaimer copy + a shared "medical claim" instruction block consumed by both `persona()` and the plan-gen system prompt, so the wording stays consistent in one place.

### Anti-Patterns to Avoid
- **Profile-scoping the knowledge table.** Knowledge is the company's (Stephanie's) brain, shared across all members. Scope `coach_knowledge` by `company_id`, never `profile_id`.
- **Embedding without key-gating.** Every embed call MUST go through `embedText()` which returns `null` when `OPENROUTER_API_KEY` is absent. Ingestion must still store chunks (embedding null) so adding the key later + a backfill pass lights up RAG - exactly how `insights.ts` backfills `coach_messages`/`food_log` embeddings.
- **Trusting AI plan JSON blindly.** Coerce/clamp every field (copy `parseNarrative`), Zod-validate before insert, and never let a malformed model reply write a half-row. Macros that do not sum to calories should be recomputed, not stored raw.
- **Inserting `plans`/`session_exercises` with hallucinated `exercise_id`s.** Those are FKs into the real `exercises` library. The model cannot invent UUIDs. Resolve names -> ids server-side (or scope v1 to meal plans only). See Open Questions.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Text -> 1536-dim vector | A new embedding client | `embedText()` in `embeddings.ts` | Already key-gated, dim-asserted, never-throws. |
| Vector literal for REST | Manual string join | `toVectorLiteral()` | pgvector needs the exact `[a,b,...]` format; the helper exists. |
| Chunking pasted text | Token-counting from scratch | Copy `chunkByParagraph` from `ai-junkies-ref/src/lib/ai/chunking.ts` | Proven ~500-tok/50-overlap paragraph splitter. |
| Cosine recall over a company's knowledge | A bespoke query in TS | `match_coach_knowledge` RPC (mirror `match_coach_memory`) | SECURITY DEFINER + HNSW does the work in Postgres; the route authorizes the scope. |
| Structured LLM output | Free-text parsing + regex | `response_format:{type:'json_object'}` + `parseNarrative`-style coercion (`insights.ts`) | Already the project pattern; Zod-validate after. |
| Spend control on new AI endpoints | New limiter | `checkRateLimit()` (`rate-limit.ts`) | DB-backed, fail-open, already on the chat route. |
| Usage metering | New table | `ai_usage_log` + `logUsage()` (`insights.ts`) | Table + writer exist (`feature`, `model`, token columns). |

**Key insight:** WP3-finish introduces exactly ONE new DB object family (`coach_knowledge` + its match RPC). Everything else is composition of shipped, tested primitives.

---

## Common Pitfalls

### Pitfall 1: Embedding-dimension drift breaks all retrieval
**What goes wrong:** A new table or a swapped model produces vectors of a different dimension; HNSW index build or `<=>` comparison fails or silently mis-ranks.
**Why:** `coach_messages`/`food_log` are `vector(1536)`; `embedText` asserts `vec.length !== 1536 -> null`. Any deviation desyncs.
**Avoid:** `coach_knowledge.embedding` MUST be `vector(1536)`, index `hnsw (embedding vector_cosine_ops)`, and ingestion MUST use `embedText` (which enforces 1536). Verified: `text-embedding-3-small` returns 1536 dims by default on OpenRouter's `/embeddings` endpoint.
**Warning sign:** RPC returns rows but similarities cluster oddly, or migration errors on index create.

### Pitfall 2: RLS leak via the new table (project has leaked RLS 3x - see MEMORY rls-isolation)
**What goes wrong:** A subscriber reads or writes another company's knowledge, or the match RPC (SECURITY DEFINER) is called without a company filter.
**Why:** SECURITY DEFINER bypasses RLS; the only guard is the explicit `where company_id = p_company_id` + the caller authorizing the scope.
**Avoid:** Keep the explicit company filter in `match_coach_knowledge` (as `match_coach_memory` does for profile). RLS policy = coach write/all + company-scoped subscriber read. After shipping, run `.qa-visual/rls-isolation-test.cjs` (per MEMORY note "run after any new table").
**Warning sign:** isolation test flags `coach_knowledge`.

### Pitfall 3: Plan-gen writes a row the existing reader can't parse
**What goes wrong:** `meal_plans.plan_jsonb` gets an AI shape that `getMealPlanDetail` (reads `plan_jsonb.mealGroups[].name/numberOfMeals`) cannot render, so the coach's Meal Plans library shows an empty/blank plan.
**Why:** The reader expects the Lenus subset (`mealGroups: [{ name, numberOfMeals }]`).
**Avoid:** Emit `plan_jsonb.mealGroups` with at least `{ name, numberOfMeals }` per group; populate the typed columns (`calorie_goal`, `protein_g`, etc.) so the list view (`mapRow`) and detail view both work.
**Warning sign:** Generated plan appears in the list with null macros or no meal groups.

### Pitfall 4: Treating `plans` as `programs`
**What goes wrong:** Plan-gen targets a non-existent `programs` table and fails.
**Why:** There is no `programs` table. The workout-program table is `public.plans` (`name_en`, `name_es`, `weeks`, `is_template`, `created_by`), with exercises in `session_exercises` (FK to `exercises`). Subscriber-facing route is `/coach/programs` but the table is `plans`.
**Avoid:** Write to `plans` + `session_exercises`. Confirm the sessions/weeks relationship before generating workouts (a `sessions`/plan-week link table was not fully traced - see Open Questions).

### Pitfall 5: Persona prompt-cache invalidation
**What goes wrong:** Injecting per-member knowledge into the CACHED persona text part defeats Anthropic prompt caching, raising cost.
**Why:** `chat.ts` deliberately splits the system message into a static cached part (`cache_control: ephemeral`) and a dynamic part. Knowledge retrieval varies per question, so it belongs in the DYNAMIC part with the memory block, not the cached persona.
**Avoid:** Append `knowledgeBlock` to `dynamicText`, keep `persona(locale)` static.

---

## Code Examples (verified, from this repo)

### The system-prompt assembly seam to extend (`src/lib/coach-ai/chat.ts:83-114`)
```ts
// buildMessages(): system = [persona (cached)] + [dynamic: contextBlock + memoryBlock].
// WP3-finish adds knowledgeBlock to the dynamic part:
const dynamicText = [
  `${contextHeader}\n${contextBlock}`,
  knowledgeBlock || null,   // NEW: company knowledge (Stephanie's method), retrieved per question
  memoryBlock || null,      // existing: member's own past records
].filter(Boolean).join('\n\n');
```

### The structured-generation call to clone (`src/lib/coach-ai/insights.ts:372-394`)
```ts
const res = await fetch(OPENROUTER_URL, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: INSIGHT_MODEL,                              // plan-gen: claude-sonnet-4-6
    response_format: { type: 'json_object' },          // forces parseable JSON
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userPrompt }],
  }),
});
// ...then defensive JSON.parse + clamp/coerce every field before any DB write.
```

### The RPC scope-guard idiom to mirror (`supabase/migrations/0030_food_log_embedding.sql:38-80`)
```sql
create or replace function public.match_coach_memory(p_profile_id uuid, query_embedding vector(1536), match_count int default 5)
returns table (source text, content text, similarity double precision, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  ... where m.profile_id = p_profile_id and m.embedding is not null ...
  order by similarity desc limit greatest(1, least(match_count, 20));
$$;
-- match_coach_knowledge swaps profile_id -> company_id, drops the food_log union.
```

---

## State of the Art

| Old approach (in repo today) | Current approach (WP3-finish) | Impact |
|---|---|---|
| Persona is a static hardcoded default voice (`PERSONA_EN/ES`); Gap Log 5 says KB pending | Persona stays static; Stephanie's voice/method enters via retrieved `coach_knowledge` block | Voice grounded in her real method without re-deploying prompt text |
| RAG only over the member's OWN data (`match_coach_memory`) | Add a second, company-scoped retrieval (`match_coach_knowledge`) | Coach can answer "how does Steph do X" from her documented method |
| Plans created manually in the coach tool | Sonnet generates a draft plan from intake + knowledge, coach reviews | Faster plan authoring; coach still owns the row |
| Safety = persona rules + `/disclaimer` gate (`0038`) | Same gate + explicit in-chat AI disclaimer + shared guardrail strings | Consistent, visible "AI, not a doctor" posture |

**Deprecated/outdated to ignore:** None in scope. Do NOT reuse `meal_plans.plan_jsonb`'s full Lenus GraphQL shape (`__typename`, `uiSettings`, `macroTiming.mealFilters`) - emit only the minimal subset the in-app reader needs.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`, so this section is included.

### Test Framework
| Property | Value |
|---|---|
| Framework | No unit-test runner is wired in this repo (no jest/vitest config found; package scripts rely on `typecheck` + `lint` + blocking hooks). |
| Config file | none - see Wave 0 |
| Quick run command | `pnpm typecheck` then `pnpm lint` (blocking hooks: typecheck, lint, check-rls-enabled, check-tenant-column, check-money-type) |
| Full suite command | `pnpm build` (Next.js 16 build must pass with no OPENROUTER_API_KEY - the key-gated contract) |
| DB/RLS check | `node .qa-visual/rls-isolation-test.cjs` after the new table; `node .qa-visual/sql.cjs "<SQL>"` to inspect rows |

### Phase Requirements -> Test Map
| Req | Behavior | Test type | Command / method | Exists? |
|---|---|---|---|---|
| Knowledge migration | `coach_knowledge` + `match_coach_knowledge` exist, RLS on | manual SQL | `node .qa-visual/sql.cjs "select tablename from pg_tables where tablename='coach_knowledge'; select proname from pg_proc where proname='match_coach_knowledge'"` | manual |
| RLS isolation | No cross-company knowledge leak | script | `node .qa-visual/rls-isolation-test.cjs` | exists |
| Ingest -> embed | Pasting text creates chunk rows; embeddings present when keyed, null when not | manual + browser | Coach Knowledge page paste -> `select count(*), count(embedding) from coach_knowledge` | manual |
| Retrieval into prompt | Chat answer reflects ingested method | browser | Ask coach a method question; observe grounded reply | manual |
| Plan-gen output | Generated `meal_plans` row renders in coach Meal Plans library | browser | Generate -> open `/coach/tool/meal-plans/[id]` | manual |
| Key-gated build | App builds + chat returns `notConfigured` with no key | build | `pnpm build` with `OPENROUTER_API_KEY` unset | command |
| Safety copy | In-chat AI disclaimer shows EN/ES | browser | Toggle locale on `/coach-chat` | manual |

### Sampling Rate
- **Per task commit:** `pnpm typecheck && pnpm lint` (blocking hooks gate the write anyway).
- **Per wave merge:** `pnpm build` green with AND without `OPENROUTER_API_KEY`; `node .qa-visual/rls-isolation-test.cjs` clean.
- **Phase gate:** Browser walkthrough of ingest -> chat-grounding -> plan-gen as a coach (`sample.casey`) and chat as a subscriber (`sample.sam`).

### Wave 0 Gaps
- [ ] No automated unit-test runner exists. Validation is typecheck + lint + Next build + the `.qa-visual` SQL/RLS scripts. Plan tasks to assert via those, not a test file, unless the planner chooses to introduce vitest (out of scope for WP3-finish).
- [ ] `node .qa-visual/rls-isolation-test.cjs` must be extended/confirmed to cover `coach_knowledge` (per MEMORY: run after any new table).

---

## Open Questions

1. **Workout program generation depth (`plans` + `session_exercises`).**
   - Known: `plans` is the program table; `session_exercises` holds the moves with FK `exercise_id` into the real `exercises` library and a `session_id`.
   - Unclear: the `plans` -> weeks -> sessions linking table was not fully traced (no `plan_days`/`sessions`/`plan_weeks` table surfaced in the coach/plan scan; `session_exercises.session_id` references an un-traced `sessions`-like table). The model cannot invent valid `exercise_id`/`session_id` UUIDs.
   - Recommendation: Scope plan-gen v1 to **meal plans only** (clean fit to `meal_plans` typed columns + `plan_jsonb` subset). For programs, generate a **structured outline** (week/day/exercise-by-NAME) and have the coach map names -> library `exercises` in the existing program editor, OR resolve names server-side against `exercises.name_en/name_es` with a fuzzy/embedding match (note `idx_exercises`/`exercises.embedding` was not confirmed). Defer full program auto-insert to a later task and confirm the sessions schema first via `sql.cjs`.

2. **Separate AI-specific acknowledgment vs reuse `health_ack_at`.**
   - Known: `0038` adds `profiles.health_ack_at`; `requireEntitled` routes un-acked members to `/disclaimer` before any training content.
   - Unclear: whether legal/product wants a distinct "I understand the AI coach is not a medical professional" ack separate from the assumption-of-risk ack.
   - Recommendation: Reuse `health_ack_at` as the gating ack (it already covers nutrition/training guidance) and show an informational AI banner in chat. If a separate ack is required, add `profiles.coach_ai_ack_at timestamptz` in the same migration and a dismiss action. Flag for Stephanie/legal.

3. **Knowledge ingestion input modes.**
   - Known: ai-junkies ingests a single pasted blob (`raw_paste`) then extracts/embeds.
   - Unclear: whether Stephanie pastes free text, fills a structured questionnaire (Gap Log 5 references "AI Knowledge Base questionnaire" pending from Shakira), or uploads files.
   - Recommendation: v1 = paste a titled text document (chunk + embed). Structure the table with `title` + `source_id` so a future questionnaire or file upload can write the same rows. Do NOT block on the questionnaire; the table accepts any text.

4. **Whether to inject knowledge always vs only on retrieval hit.**
   - Recommendation: Retrieval-gated (top-K by the member's question) to control tokens, matching the memory-block pattern. A small always-on "voice summary" could also live in the persona later if Stephanie provides a short brand-voice paragraph.

---

## Sources

### Primary (HIGH confidence - files read in this session)
- `src/lib/coach-ai/embeddings.ts` - EMBED_MODEL/EMBED_DIMS(1536), embedText, toVectorLiteral, retrieveMemories, renderMemoryBlock, key-gating contract.
- `src/lib/coach-ai/chat.ts` - persona (static/cached) + dynamic context/memory assembly, OpenRouter streaming, notConfigured degradation, the documented KB swap point (lines 38-41).
- `src/lib/coach-ai/insights.ts` - Sonnet JSON-mode `extractNarrative`/`parseNarrative`, `logUsage` -> `ai_usage_log`, embedding backfill pattern.
- `src/lib/coach-ai/context.ts` - buildCoachContext data sources (profiles, onboarding_responses, food_log, weight_entries, user_insights, coach_messages), renderContextBlock.
- `src/app/api/coach-ai/chat/route.ts` - auth + rate-limit + Zod + streaming route shape.
- `supabase/migrations/0028_ai_coach.sql`, `0030_food_log_embedding.sql`, `0038_health_ack.sql` - vector(1536)/HNSW table+index recipe, match_coach_memory RPC, health_ack gate.
- DB introspection via `.qa-visual/sql.cjs`: `meal_plans`/`plans`/`plan_assignments`/`session_exercises`/`exercises`/`onboarding_responses`/`user_insights` columns; RLS policies; vector indexes; `current_company_id()`/`is_coach()`/`match_coach_memory` defs; confirmed NO `programs` table; `ai_usage_log`/`rate_limit_log` exist.
- `src/lib/coach/meal-plans.ts` - how `plan_jsonb.mealGroups` is read (the shape plan-gen must emit).
- `src/lib/community/challenge-actions.ts` - canonical `'use server'` + Zod + requireCoach + insert + revalidatePath.
- `src/lib/auth/guards.ts`, `src/lib/security/rate-limit.ts`, `src/components/nav/coach-nav.tsx`, `src/app/(app)/disclaimer/page.tsx`, `src/app/(app)/coach-chat/page.tsx`.
- `.planning/config.json` - nyquist_validation true.

### Reference repo (HIGH confidence - read in ai-junkies-ref)
- `C:/Users/dre/ai-junkies-ref/src/lib/ai/chunking.ts` - chunkByParagraph (~500 tok / ~50 overlap). Copy for `chunkKnowledge`.
- `C:/Users/dre/ai-junkies-ref/src/lib/instructor-kb/embed.ts` + `extract.ts` - build-embedding-text + structured extraction patterns (analog to knowledge + plan-gen).
- `C:/Users/dre/ai-junkies-ref/supabase/migrations/00187_instructor_kb.sql` - KB table + RLS + embedding-status lifecycle (analog).

### Secondary (MEDIUM - external, verified against repo usage)
- OpenRouter Embeddings API docs - `text-embedding-3-small` = 1536 dims, `/api/v1/embeddings`, optional `dimensions` param. Matches `embeddings.ts` exactly. https://openrouter.ai/docs/api/reference/embeddings

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH - every primitive is in-repo and read directly.
- Architecture (knowledge + safety): HIGH - direct mirror of `match_coach_memory`/`0030` + existing persona/disclaimer.
- Architecture (program plan-gen): MEDIUM - `plans`/`session_exercises` confirmed but the weeks->sessions link + exercise-id resolution need a schema trace before auto-insert (Open Question 1). Meal-plan-gen is HIGH.

**Research date:** 2026-06-28
**Valid until:** ~2026-07-28 (stable in-repo patterns; re-confirm only if the embedding model or coach-ai libs change).
