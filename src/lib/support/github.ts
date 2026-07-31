import 'server-only';
// Stage 3a: a triaged BUG becomes a GitHub issue, pre-diagnosed.
//
// This is the honest version of "send the ticket to Claude Code". Claude Code is a local CLI with no
// inbound endpoint, so nothing can push work into it. What works is putting the work where work
// already lives: an issue carrying the member's own words, the account facts, and the files to open
// first. Any coding agent (or human) can then be pointed at it by number.
//
// Deliberately NOT autonomous. This opens an issue; it never branches, commits, or merges. An agent
// with write access to the repo that serves member PII is a production system needing its own
// security review, not a convenience to bolt on before launch.
//
// Fully optional: with no GITHUB_TOKEN the whole module no-ops, so support works without it.
import { createServiceClient } from '@/lib/supabase/service';
import type { TriageResult } from '@/lib/support/triage';

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO ?? 'DreTheGeek/thickandfit';
/** Below this the triage is guessing, and a speculative issue costs more attention than it saves. */
const MIN_CONFIDENCE = 0.7;

export function githubConfigured(): boolean {
  return Boolean(TOKEN);
}

/**
 * Open an issue for a bug ticket. Never throws, never blocks, and writes the URL back so the board
 * can link out AND so a re-triage cannot open a second issue for the same ticket.
 */
export async function openIssueForTicket(input: {
  ticketId: string;
  companyId: string;
  subject: string;
  body: string | null;
  email: string | null;
  triage: TriageResult;
}): Promise<string | null> {
  if (!TOKEN) return null;
  if (input.triage.category !== 'bug') return null;
  if (input.triage.confidence < MIN_CONFIDENCE) return null;

  const svc = createServiceClient();
  // Re-check under the row we are about to write: triage can run twice (a retry sweep, a manual
  // re-run), and two issues for one report is worse than none.
  const { data: existing } = await svc
    .from('support_tickets')
    .select('github_issue_url')
    .eq('id', input.ticketId)
    .maybeSingle();
  if ((existing as { github_issue_url: string | null } | null)?.github_issue_url) return null;

  const lines = [
    `**Reported via support** (ticket \`${input.ticketId}\`)`,
    '',
    `> ${input.triage.summary}`,
    '',
    '### What the member wrote',
    '```',
    (input.body ?? input.subject).slice(0, 4000),
    '```',
    '',
    '### Account facts at report time',
    input.triage.memberContext,
    '',
  ];
  if (input.triage.likelyArea.length) {
    lines.push('### Where to look first', ...input.triage.likelyArea.map((f) => `- \`${f}\``), '');
  }
  lines.push(
    '---',
    `Triage confidence ${input.triage.confidence.toFixed(2)}. Filed automatically from the support board;`,
    'the file list is a starting point, not a diagnosis. Do not reply to the member from here.',
  );

  const title = `[support] ${input.triage.summary.slice(0, 120)}`;
  const body = lines.join('\n');
  const labels = ['support', 'bug', ...(input.triage.priority === 'urgent' ? ['urgent'] : [])];

  const post = async (withLabels: string[]): Promise<Response> =>
    fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, ...(withLabels.length ? { labels: withLabels } : {}) }),
    });

  try {
    let res = await post(labels);
    // GitHub 422s the whole issue when a label does not exist in the repo, and the token may also
    // lack permission to create one. Losing a member's bug report over a missing tag is absurd, so
    // retry bare. The `support`/`bug`/`urgent` labels were created 2026-07-31; this is the guard for
    // the day someone deletes one or the repo changes.
    if (res.status === 422 && labels.length) {
      console.error('openIssueForTicket: 422 with labels, retrying without');
      res = await post([]);
    }
    if (!res.ok) {
      console.error('openIssueForTicket:', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as { html_url?: string };
    const url = json.html_url ?? null;
    if (url) await svc.from('support_tickets').update({ github_issue_url: url }).eq('id', input.ticketId);
    return url;
  } catch (e) {
    console.error('openIssueForTicket:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * The member's email must never reach GitHub. The issue carries their words and their account
 * SHAPE, not their identity: the repo is private today but issues outlive that assumption, and a
 * support report is not a reason to publish someone's address. The ticket id is the join back.
 */
