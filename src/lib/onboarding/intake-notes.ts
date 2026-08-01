import 'server-only';
// Free-text intake notes: a member writes whatever they want, and this turns it into structure the
// plan and the coach can actually act on.
//
// WHY THIS EXISTS. Chips only capture what we thought to ask. Real intake is "I had a c-section in
// March and my left shoulder clicks overhead, and I'm allergic to shellfish" — three actionable
// facts, none of which any chip on the screen offers. Without a free-text box that information
// simply does not enter the system, and the coach finds out in week three.
//
// TWO RULES THAT SHAPE EVERYTHING BELOW:
//
// 1. The RAW TEXT IS THE RECORD. Extraction is an index over it, never a replacement. Stephanie and
//    the coach surfaces read what the member actually wrote; if the model mis-parses, a human still
//    sees the original sentence. Nothing here overwrites member words with model words.
//
// 2. EXTRACTION MAY ONLY ADD, NEVER REMOVE. It can surface a condition the chips missed. It must not
//    clear an injury the member explicitly ticked, because "no mention" is not "no". A model that
//    can delete a safety-relevant flag is a model that can hurt someone.
import { callJson } from '@/lib/ai/client';
import { AI_MODELS } from '@/lib/ai/models';
import { INJURIES, CONDITIONS, SAFETY } from '@/lib/health-profile/labels';

export const INTAKE_NOTES_PROMPT_VERSION = 'intake-notes.v1';

export type IntakeExtraction = {
  /** Chip slugs the text implies, to be UNIONED with what the member ticked. */
  injuries: string[];
  conditions: string[];
  safety: string[];
  /** Foods to avoid: allergies, intolerances, dislikes. Free-form, lowercased. */
  avoidFoods: string[];
  /** Equipment or access constraints ("no gym", "only dumbbells", "home only"). */
  constraints: string[];
  /** A one-line summary for the coach's client card. */
  summary: string;
  /** True when a human should read this BEFORE a plan is generated. */
  needsCoachReview: boolean;
  /** Why review is needed, when it is. */
  reviewReason: string | null;
};

const EMPTY: IntakeExtraction = {
  injuries: [], conditions: [], safety: [], avoidFoods: [], constraints: [],
  summary: '', needsCoachReview: false, reviewReason: null,
};

function only(values: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(values)) return [];
  const set = new Set(allowed);
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && set.has(v)))];
}

function strings(values: unknown, max: number): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(
    values
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v.length > 1 && v.length <= 60),
  )].slice(0, max);
}

const SYSTEM = [
  'You read a fitness member\'s free-text intake note and extract structured facts for their coach.',
  'Return ONLY JSON. No prose, no markdown fence.',
  '',
  'Extract:',
  `- injuries: slugs from this list ONLY: ${INJURIES.join(', ')}`,
  `- conditions: slugs from this list ONLY: ${CONDITIONS.join(', ')}`,
  `- safety: slugs from this list ONLY: ${SAFETY.join(', ')}`,
  '- avoid_foods: allergies, intolerances and strong dislikes, as short lowercase food names',
  '- constraints: equipment or access limits, e.g. "no gym", "dumbbells only", "trains at home"',
  '- summary: ONE sentence a coach can read at a glance',
  '- needs_coach_review: true when a human should read this before any plan is generated',
  '- review_reason: why, or null',
  '',
  'Rules:',
  '- Extract only what the member actually said. Never infer a diagnosis they did not state.',
  '- If it does not map to a slug in the lists, leave those arrays empty and describe it in summary.',
  '- needs_coach_review = true for: pregnancy or postpartum, a recent surgery, chest pain, fainting,',
  '  an eating disorder history, a named medication, or anything that reads as medically serious.',
  '  When unsure, set it TRUE. A human glancing at one extra note costs far less than a missed one.',
  '- Never diagnose, never advise, never reassure. You are indexing, not coaching.',
  '- Never use an em dash or en dash in summary; use a period or comma.',
].join('\n');

/**
 * Parse one intake note. Returns EMPTY on any failure, never throws: this runs behind the response,
 * and a failed extraction must leave the member's raw text untouched and the plan unblocked.
 */
export async function extractIntakeNotes(
  note: string,
  ctx: { companyId: string; profileId: string },
): Promise<IntakeExtraction> {
  const text = note.trim();
  if (text.length < 4) return EMPTY;
  try {
    const res = await callJson({
      models: [AI_MODELS.supportTriage, AI_MODELS.chat],
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text.slice(0, 4000) },
      ],
      responseFormat: 'json_object',
      timeoutMs: 25_000,
      traceFeature: 'intake-notes',
      companyId: ctx.companyId,
      profileId: ctx.profileId,
    });
    if (res.status !== 'ok') return EMPTY;
    const raw = JSON.parse(res.content) as Record<string, unknown>;
    const summary = typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 300) : '';
    return {
      // Slug lists are allowlisted, so a hallucinated slug cannot reach the health profile.
      injuries: only(raw.injuries, INJURIES),
      conditions: only(raw.conditions, CONDITIONS),
      safety: only(raw.safety, SAFETY),
      avoidFoods: strings(raw.avoid_foods, 20),
      constraints: strings(raw.constraints, 10),
      summary,
      needsCoachReview: raw.needs_coach_review === true,
      reviewReason: typeof raw.review_reason === 'string' ? raw.review_reason.trim().slice(0, 200) : null,
    };
  } catch (e) {
    console.error('extractIntakeNotes:', e instanceof Error ? e.message : e);
    return EMPTY;
  }
}

/**
 * Union the member's ticked chips with what the model found.
 *
 * ADD-ONLY, and this function is the enforcement point. It takes the member's selections as the base
 * and can only grow them. There is deliberately no code path here that removes a slug: if the member
 * ticked "knees" and the note says nothing about knees, "knees" survives.
 */
export function mergeSlugs<T extends string>(
  chosen: readonly T[],
  extracted: readonly string[],
  allowed: readonly T[],
): T[] {
  // Generic so the caller's narrow slug union survives. The health profile types these as literal
  // unions, not string[], and widening here would force an `as` cast at every call site, which is
  // exactly where a hallucinated slug would slip through the allowlist.
  const set = new Set<string>(allowed);
  return [...new Set<string>([...chosen, ...extracted])].filter((v): v is T => set.has(v));
}
