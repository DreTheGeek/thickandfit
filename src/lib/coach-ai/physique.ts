// AI physique analysis (sibling to photo-to-macro). A member's progress photo + their context (weight,
// height, goal, history, and Stephanie's coaching knowledge) -> a supportive, coach's-eye body-comp read
// + a staged, body-positive recommendation in Stephanie's voice. Body-fat is ALWAYS a RANGE (estimate,
// never precise). Single flagship-vision call with context injection (the proven accuracy lever from the
// macro research). No OPENROUTER_API_KEY => clean 'notConfigured'; it never crashes.
//
// SAFETY: the system prompt below is the DRAFT for Stephanie to approve. It is body-positive,
// eating-disorder-aware, non-shaming, defers all medical questions, and flags anything a human coach
// should review. Stephanie can refine the voice/philosophy through her AI Knowledge builder (passed in
// as `knowledge`) without code changes.
import 'server-only';
import { AI_MODELS } from '@/lib/ai/models';
import { callJson, hashInput } from '@/lib/ai/client';

// No-compromise vision per the photo priority. Routed centrally (gpt-5: $1.25/$10, image-capable, the
// model from the best published macro study). Progress photos are low-frequency so a flagship is cheap
// in aggregate. The eval decides the final pick (challengers: openai/gpt-5.4, google/gemini-3.1-pro-preview).
export const PHYSIQUE_MODEL = AI_MODELS.physique;
// Bump when systemPrompt changes so replay/eval can group inferences by prompt generation.
const PROMPT_VERSION = 'physique.v2'; // v2 (2026-07-31): no-dash style rule

export type PhysiqueAnalysis = {
  bfLow: number | null;
  bfHigh: number | null;
  assessment: { strengths: string[]; focusAreas: string[]; compositionNotes: string };
  goals: { staged: string[]; timeline: string; approach: string };
  narrative: string;
  flagged: boolean;
  model: string;
};

export type PhysiqueResult =
  | { status: 'ok'; analysis: PhysiqueAnalysis }
  | { status: 'notConfigured' }
  | { status: 'error' };

export type PhysiqueContext = {
  imageUrl: string; // signed storage URL or data URL of the progress photo
  weightLb?: number | null;
  heightIn?: number | null;
  goal?: string | null; // the member's stated goal, in her words
  history?: string | null; // prior weights/photos summary, optional
  knowledge?: string | null; // Stephanie's relevant coaching notes (RAG), optional
  locale: 'en' | 'es';
};

// --- The safety + coaching system prompt (DRAFT for Stephanie's approval) --------------------------
function systemPrompt(locale: 'en' | 'es'): string {
  const lang = locale === 'es' ? 'Latin-American Spanish' : 'English';
  return [
    "You are the AI coaching assistant for Thick & Fit, the bilingual fitness community founded by Stephanie Pantoja. A member has shared a progress photo and wants an encouraging, coach's-eye read. You speak in Stephanie's voice: warm, real, hype-but-honest, and always in the member's corner. Most members are women.",
    '',
    'NON-NEGOTIABLE SAFETY RULES:',
    '- NEVER shame or judge. Do not talk about "flaws" or "fixing" her body. Always lead with what is genuinely working.',
    '- Body-fat percent is an ESTIMATE from one photo. ALWAYS give a RANGE (e.g. "around 24-28%"), call it a coach\'s-eye estimate, and make clear it is not a medical or DEXA measurement. Never a single precise number.',
    '- Be body-positive and goal-relative: anchor everything to HER stated goal and her health, not an idealized standard. Strong and healthy over skinny.',
    '- Be eating-disorder aware: never encourage restriction, "earning" food, purging, or obsession. If the photo or context suggests possible disordered eating, very low body fat, or distress, set flagged=true and gently suggest she check in with Stephanie (and a healthcare professional if relevant). Do NOT diagnose.',
    '- No medical claims. Defer anything clinical (PCOS, hormones, thyroid, injury, pregnancy) to a healthcare professional.',
    '- Realistic and kind: stage the plan into achievable milestones, celebrate the body she has today, and emphasize physique and health over the scale number.',
    '- STYLE: never use an em dash or en dash. Use a period, comma, or colon. She reads this text verbatim.',
    '',
    "COACHING STYLE (Stephanie): meet her where she is; reframe goals positively; build on her strengths and what her body already does well; if she has been at a leaner/stronger place before, use that (muscle memory, she already knows how); give a realistic staged path and a simple sustainable approach (movement, protein, consistency); end on real belief in her.",
    '',
    'Use the member context (reported weight, height, history, goal) to GROUND the read - it matters more than the pixels. Tailor everything to her stated goal if one is given. If Stephanie coaching notes are provided, follow them.',
    '',
    `Respond ONLY with minified JSON of this exact shape (write every prose field in ${lang}), no markdown, no prose outside the JSON:`,
    '{"bfLow":number,"bfHigh":number,"assessment":{"strengths":[string],"focusAreas":[string],"compositionNotes":string},"goals":{"staged":[string],"timeline":string,"approach":string},"narrative":string,"flagged":boolean}',
    'Rules for the fields: bfLow/bfHigh = estimated body-fat % range. strengths = 2-4 genuine positives. focusAreas = 1-3 gentle opportunities, never flaws. staged = 2-3 realistic milestones toward her goal. narrative = the warm coaching write-up in Stephanie\'s voice, 120-220 words. flagged = true ONLY if a human coach should review for a safety or wellbeing reason.',
  ].join('\n');
}

function userContext(c: PhysiqueContext): string {
  const lines = ['Member context for grounding the read (this matters more than the pixels):'];
  if (c.weightLb) lines.push(`- Reported weight: ${c.weightLb} lb`);
  if (c.heightIn) lines.push(`- Height: ${c.heightIn} in`);
  if (c.goal) lines.push(`- Her stated goal (her words): ${c.goal}`);
  if (c.history) lines.push(`- History: ${c.history}`);
  if (c.knowledge) lines.push(`\nStephanie's relevant coaching notes:\n${c.knowledge}`);
  lines.push('\nGive her the encouraging, coach\'s-eye read now.');
  return lines.join('\n');
}

function num(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : null;
}

function strArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim()).slice(0, max);
}

export async function analyzePhysique(
  c: PhysiqueContext,
  prov?: { companyId: string; profileId: string },
): Promise<PhysiqueResult> {
  try {
    const res = await callJson({
      models: [PHYSIQUE_MODEL],
      timeoutMs: 90_000,
      messages: [
        { role: 'system', content: systemPrompt(c.locale) },
        {
          role: 'user',
          content: [
            { type: 'text', text: userContext(c) },
            { type: 'image_url', image_url: { url: c.imageUrl } },
          ],
        },
      ],
      // fire: the inference id has no consumer today (no correction UI on physique reads).
      ...(prov
        ? {
            provenance: {
              feature: 'physique' as const,
              promptVersion: PROMPT_VERSION,
              companyId: prov.companyId,
              profileId: prov.profileId,
              inputHash: hashInput(c.imageUrl),
              mode: 'fire' as const,
            },
          }
        : {}),
    });
    if (res.status === 'notConfigured') return { status: 'notConfigured' };
    if (res.status !== 'ok') return { status: 'error' };
    const p = JSON.parse(res.content) as Record<string, unknown>;
    const a = (p.assessment ?? {}) as Record<string, unknown>;
    const g = (p.goals ?? {}) as Record<string, unknown>;

    const analysis: PhysiqueAnalysis = {
      bfLow: num(p.bfLow),
      bfHigh: num(p.bfHigh),
      assessment: {
        strengths: strArray(a.strengths, 4),
        focusAreas: strArray(a.focusAreas, 3),
        compositionNotes: typeof a.compositionNotes === 'string' ? a.compositionNotes.trim() : '',
      },
      goals: {
        staged: strArray(g.staged, 3),
        timeline: typeof g.timeline === 'string' ? g.timeline.trim() : '',
        approach: typeof g.approach === 'string' ? g.approach.trim() : '',
      },
      narrative: typeof p.narrative === 'string' ? p.narrative.trim() : '',
      flagged: p.flagged === true,
      model: PHYSIQUE_MODEL,
    };
    if (!analysis.narrative) return { status: 'error' };
    return { status: 'ok', analysis };
  } catch {
    return { status: 'error' };
  }
}
