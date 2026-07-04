// ES exercise-name fill (WP13). All 873 exercises have cues_en (a good translation source) but
// name_es is NULL for all of them. This batch-translates name_en + cues_en into LATAM Spanish via
// the existing lazy OpenRouter client, then writes name_es / cues_es. It is HUMAN-REVIEW gated:
// the output is a draft for Stephanie / Shakira to approve before it goes live (fitness names are
// idiom, not prose). Without OPENROUTER_API_KEY this is a clean no-op (never crashes, never invents).
//
// muscle_groups / equipment already ship curated ES labels (0007_exercises.sql); we pass those as a
// glossary so the model stays consistent with the vocabulary the app already shows.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { aiConfigured, callJson } from '@/lib/ai/client';
import { AI_MODELS } from '@/lib/ai/models';

const BATCH_SIZE = 20; // names per model call; small enough to stay reliable, large enough to be cheap

// Curated ES glossary reused from the exercise seed vocabulary (0007_exercises.sql:11-45). Few-shot
// anchors so the model uses the same muscle / equipment words the UI already renders.
const GLOSSARY = [
  'chest=pecho',
  'back=espalda',
  'shoulders=hombros',
  'biceps=bíceps',
  'triceps=tríceps',
  'forearms=antebrazos',
  'abdominals=abdominales',
  'quadriceps=cuádriceps',
  'hamstrings=isquiotibiales',
  'glutes=glúteos',
  'calves=pantorrillas',
  'barbell=barra',
  'dumbbell=mancuerna',
  'kettlebell=pesa rusa',
  'cable=polea',
  'machine=máquina',
  'bodyweight=peso corporal',
  'bands=bandas',
].join(', ');

const SYSTEM_PROMPT = [
  'You are a bilingual strength-and-conditioning translator for a fitness coaching app whose audience',
  'is Latin American Spanish-speaking women. Translate each English exercise name and its coaching',
  'cues into natural LATAM Spanish gym vernacular, NOT a literal word-for-word translation.',
  'Use established Spanish names for lifts (e.g. "deadlift" -> "peso muerto", "squat" -> "sentadilla",',
  '"bench press" -> "press de banca", "lunge" -> "zancada"). Keep proper equipment brand words as-is.',
  `Muscle / equipment glossary to stay consistent with: ${GLOSSARY}.`,
  'Use correct Spanish accents. Do not use em dashes. Keep cues concise and instructional.',
  'Return ONLY minified JSON of this exact shape, no prose, no markdown fences:',
  '{"items":[{"id":string,"name_es":string,"cues_es":string}]}',
  'Preserve each id exactly as given. If you cannot translate cues, return an empty string for cues_es.',
].join('\n');

export type EsFillRow = { id: string; name_en: string; cues_en: string | null };
export type EsFillDraft = { id: string; name_es: string; cues_es: string };
export type EsFillResult = {
  status: 'ok' | 'notConfigured' | 'error';
  translated: number;
  written: number;
  remaining: number;
};

// Calls the model for one batch. Returns null on any failure so the caller can degrade / retry.
async function translateBatch(rows: EsFillRow[]): Promise<EsFillDraft[] | null> {
  const payload = rows.map((r) => ({ id: r.id, name_en: r.name_en, cues_en: r.cues_en ?? '' }));
  try {
    const res = await callJson({
      models: [AI_MODELS.esFill],
      timeoutMs: 60_000,
      traceFeature: 'es-fill',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ items: payload }) },
      ],
    });
    if (res.status !== 'ok') return null;
    const parsed = JSON.parse(res.content) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return null;
    return parsed.items
      .map((it): EsFillDraft | null => {
        if (!it || typeof it !== 'object') return null;
        const o = it as Record<string, unknown>;
        const id = typeof o.id === 'string' ? o.id : '';
        const name_es = typeof o.name_es === 'string' ? o.name_es.trim() : '';
        const cues_es = typeof o.cues_es === 'string' ? o.cues_es.trim() : '';
        if (!id || !name_es) return null;
        return { id, name_es, cues_es };
      })
      .filter((x): x is EsFillDraft => x !== null);
  } catch {
    return null;
  }
}

// Fill name_es / cues_es for exercises that still lack a Spanish name. Idempotent: it only reads rows
// where name_es IS NULL, so re-running picks up where it left off. limit caps how many to do per call
// (cost / rate control). Pass dryRun=true to get the drafts back WITHOUT writing (human-review mode).
export async function fillExerciseSpanish(
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<EsFillResult & { drafts?: EsFillDraft[] }> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 873);
  const svc = createServiceClient();

  const { data: rows, error } = await svc
    .from('exercises')
    .select('id, name_en, cues_en')
    .is('name_es', null)
    .order('name_en', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('fillExerciseSpanish read:', error.message);
    return { status: 'error', translated: 0, written: 0, remaining: -1 };
  }
  const pending = (rows ?? []) as EsFillRow[];
  if (!aiConfigured()) {
    // No key: report what WOULD be done, change nothing.
    const { count } = await svc
      .from('exercises')
      .select('id', { count: 'exact', head: true })
      .is('name_es', null);
    return { status: 'notConfigured', translated: 0, written: 0, remaining: count ?? pending.length };
  }
  if (pending.length === 0) return { status: 'ok', translated: 0, written: 0, remaining: 0 };

  const allDrafts: EsFillDraft[] = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const drafts = await translateBatch(batch);
    if (drafts) allDrafts.push(...drafts);
  }

  if (opts.dryRun) {
    const { count } = await svc
      .from('exercises')
      .select('id', { count: 'exact', head: true })
      .is('name_es', null);
    return {
      status: 'ok',
      translated: allDrafts.length,
      written: 0,
      remaining: count ?? pending.length,
      drafts: allDrafts,
    };
  }

  // Write each draft. Per-row update keeps a bad single translation from sinking the batch.
  let written = 0;
  for (const d of allDrafts) {
    const { error: upErr } = await svc
      .from('exercises')
      .update({ name_es: d.name_es, cues_es: d.cues_es || null })
      .eq('id', d.id)
      .is('name_es', null); // guard: never overwrite a human-reviewed value
    if (upErr) {
      console.error('fillExerciseSpanish write:', upErr.message);
      continue;
    }
    written += 1;
  }

  const { count } = await svc
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .is('name_es', null);

  return { status: 'ok', translated: allDrafts.length, written, remaining: count ?? 0 };
}
