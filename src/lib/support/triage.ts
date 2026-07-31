import 'server-only';
// Support ticket triage.
//
// THE ENRICHMENT IS THE POINT, NOT THE CLASSIFICATION. Most support tickets are answerable from
// facts we already hold: is she a member, is she entitled, when did she last log in, did her scans
// fail, is she a waitlist lead who never confirmed. So this looks the member up FIRST and hands the
// model that dossier. A model guessing from a subject line is worth very little; a model reading
// "subscriber, entitled, 3 scans in the last week, 2 of them errored" is worth a lot.
//
// Hard rule: suggested_reply is a DRAFT. Nothing here ever sends anything to a member. Launch week
// is the worst possible time to discover an agent apologising on Stephanie's behalf for something
// that never happened.
//
// Everything is best-effort. An untriaged ticket is a normal ticket, so no failure in here may
// prevent the ticket from existing.
import { callJson } from '@/lib/ai/client';
import { AI_MODELS } from '@/lib/ai/models';
import { createServiceClient } from '@/lib/supabase/service';
import { isEntitled } from '@/lib/billing/entitlement';

export const TRIAGE_PROMPT_VERSION = 'support-triage.v1';

export type TriageResult = {
  category: 'billing' | 'account' | 'bug' | 'content' | 'other';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  summary: string;
  memberFound: boolean;
  memberContext: string;
  likelyArea: string[];
  suggestedReply: string;
  confidence: number;
};

const CATEGORIES = ['billing', 'account', 'bug', 'content', 'other'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

/**
 * Everything we already know about the person who wrote in, assembled from our own tables.
 *
 * Returns a human-readable line rather than a struct: it goes straight into a prompt AND straight
 * onto the operator's screen, and two shapes of the same facts would drift apart.
 */
async function buildMemberDossier(
  email: string | null,
  companyId: string,
): Promise<{ found: boolean; context: string }> {
  if (!email) return { found: false, context: 'No email on the ticket, so no account could be matched.' };
  const svc = createServiceClient();
  const normalized = email.trim().toLowerCase();

  const { data: profileRow } = await svc
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('email', normalized)
    .maybeSingle();
  const profile = profileRow as { id: string; full_name: string | null; role: string; created_at: string } | null;

  if (!profile) {
    // Not a member. Still worth checking the funnel: "I signed up and heard nothing" is a waitlist
    // lead who never confirmed, and that is a different answer entirely from "your account is fine".
    const { data: leadRow } = await svc
      .from('waitlist_leads')
      .select('created_at, confirmed_at, entry_count')
      .eq('company_id', companyId)
      .eq('email', normalized)
      .maybeSingle();
    const lead = leadRow as { created_at: string; confirmed_at: string | null; entry_count: number } | null;
    if (lead) {
      return {
        found: false,
        context: `No app account. IS a waitlist lead (joined ${day(lead.created_at)}, ${
          lead.confirmed_at ? 'confirmed' : 'NEVER CONFIRMED their email'
        }, ${lead.entry_count} entries).`,
      };
    }
    return { found: false, context: `No account and no waitlist entry for ${normalized}.` };
  }

  const [entitled, scans, logs] = await Promise.all([
    isEntitled(profile.id).catch(() => false),
    svc
      .from('ai_inferences')
      .select('status', { count: 'exact' })
      .eq('profile_id', profile.id)
      .gte('created_at', new Date(Date.now() - 14 * 86_400_000).toISOString()),
    svc
      .from('food_log')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profile.id)
      .gte('log_date', new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10)),
  ]);

  const scanRows = (scans.data ?? []) as { status: string }[];
  const failed = scanRows.filter((s) => s.status !== 'ok').length;

  const parts = [
    `${profile.full_name ?? 'no name'} (${profile.role}), joined ${day(profile.created_at)}`,
    entitled ? 'entitled' : 'NOT entitled',
    `${logs.count ?? 0} food logs in 14d`,
    `${scanRows.length} scans in 14d${failed ? `, ${failed} FAILED` : ''}`,
  ];
  return { found: true, context: parts.join(' · ') };
}

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'unknown' : d.toISOString().slice(0, 10);
}

const SYSTEM = [
  'You triage customer support tickets for a fitness coaching app.',
  'Return ONLY JSON matching the requested shape. No prose, no markdown fence.',
  '',
  'Rules:',
  '- Use the MEMBER FACTS block as ground truth. Never contradict it and never invent account details.',
  '- If the facts do not answer the question, say so in suggested_reply instead of guessing.',
  '- suggested_reply is a DRAFT a human will read and edit. Write it as the coach would: warm, plain,',
  '  direct, no corporate padding, no apologies for things that did not happen. Never promise a refund,',
  '  a credit, a date, or a fix you cannot verify from the facts.',
  '- likely_area: repo file paths a developer would open FIRST, only when category is "bug". Otherwise [].',
  '- priority: urgent only for money moving wrongly, a member locked out, or data loss. Not for "it is slow".',
  '- confidence: how sure you are of the category and summary, 0 to 1.',
  '',
  'Never use the words "AI" or "artificial intelligence" in suggested_reply. The product is the coach\'s method.',
].join('\n');

/**
 * Triage one ticket. Returns null when unconfigured or on any failure, and NEVER throws: the caller
 * runs this behind the response, so a thrown error here would be an unhandled rejection on a
 * background task rather than something a user could act on.
 */
export async function triageTicket(input: {
  ticketId: string;
  companyId: string;
  subject: string;
  body: string | null;
  email: string | null;
  source: string | null;
}): Promise<TriageResult | null> {
  try {
    const dossier = await buildMemberDossier(input.email, input.companyId);

    const user = [
      `SOURCE: ${input.source ?? 'manual'}`,
      `FROM: ${input.email ?? '(no email given)'}`,
      `SUBJECT: ${input.subject}`,
      '',
      'MESSAGE:',
      input.body?.trim() || '(no body was provided; the subject is all we have)',
      '',
      'MEMBER FACTS (from our database, authoritative):',
      dossier.context,
      '',
      'Return JSON with exactly these keys:',
      '{"category":"billing|account|bug|content|other","priority":"low|normal|high|urgent",',
      '"summary":"one sentence","likely_area":["path/to/file.ts"],',
      '"suggested_reply":"draft reply to the member","confidence":0.0}',
    ].join('\n');

    const res = await callJson({
      models: [AI_MODELS.supportTriage, AI_MODELS.chat],
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
      responseFormat: 'json_object',
      timeoutMs: 30_000,
      traceFeature: 'support-triage',
      companyId: input.companyId,
      correlationId: input.ticketId,
    });
    if (res.status !== 'ok') return null;

    const raw = JSON.parse(res.content) as Record<string, unknown>;
    const category = pick(raw.category, CATEGORIES, 'other');
    return {
      category,
      priority: pick(raw.priority, PRIORITIES, 'normal'),
      summary: str(raw.summary).slice(0, 300) || input.subject,
      memberFound: dossier.found,
      memberContext: dossier.context,
      // Only a bug ticket gets file paths. A billing question with a confident list of source files
      // is noise that makes the whole panel less trustworthy.
      likelyArea: category === 'bug' ? arr(raw.likely_area).slice(0, 5) : [],
      suggestedReply: str(raw.suggested_reply).slice(0, 2000),
      confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
    };
  } catch (e) {
    console.error('triageTicket:', e instanceof Error ? e.message : e);
    return null;
  }
}

function pick<T extends readonly string[]>(v: unknown, allowed: T, fallback: T[number]): T[number] {
  const s = String(v ?? '').trim().toLowerCase();
  return (allowed as readonly string[]).includes(s) ? (s as T[number]) : fallback;
}
function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
}
