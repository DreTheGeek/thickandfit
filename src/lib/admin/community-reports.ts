import 'server-only';
// Read model for /admin/community/reports. Joins each report to its post body and the two people
// involved (reporter + reported) so the operator can judge without opening three tabs.
//
// Company-scoped on every query. Post body is truncated for the queue view; the full text stays one
// click away in the community surface itself.
import { createServiceClient } from '@/lib/supabase/service';

export type ReportReason = 'spam' | 'harassment' | 'self_harm' | 'nudity' | 'misinformation' | 'other';
export type ReportStatus = 'open' | 'dismissed' | 'actioned';

export type ReportRow = {
  id: string;
  postId: string;
  postBody: string;
  postAuthorName: string;
  reportedProfileId: string | null;
  reporterName: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
};

export type ReportsBoard = {
  rows: ReportRow[];
  kpi: {
    open: number;
    dismissed7d: number;
    actioned7d: number;
    topReasons: { reason: ReportReason; count: number }[];
  };
};

const QUEUE_CAP = 200;
const PREVIEW_CHARS = 220;

type RawReport = {
  id: string;
  post_id: string;
  reporter_profile_id: string | null;
  reported_profile_id: string | null;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  created_at: string;
};

export async function getReportsBoard(
  companyId: string,
  statusFilter: 'open' | 'all' = 'open',
): Promise<ReportsBoard> {
  const sb = createServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  let queueQuery = sb
    .from('community_reports')
    .select('id, post_id, reporter_profile_id, reported_profile_id, reason, note, status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(QUEUE_CAP);
  if (statusFilter === 'open') queueQuery = queueQuery.eq('status', 'open');

  const [queueRes, openRes, dismissedRes, actionedRes, reasonRes] = await Promise.all([
    queueQuery,
    sb.from('community_reports').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'open'),
    sb.from('community_reports').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'dismissed').gte('resolved_at', sevenDaysAgo),
    sb.from('community_reports').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'actioned').gte('resolved_at', sevenDaysAgo),
    sb.from('community_reports').select('reason').eq('company_id', companyId).eq('status', 'open'),
  ]);

  const raw = (queueRes.data ?? []) as RawReport[];

  // Batch-resolve the two joins rather than N+1: one posts read, one profiles read.
  const postIds = [...new Set(raw.map((r) => r.post_id))];
  const profileIds = [
    ...new Set(
      raw.flatMap((r) => [r.reporter_profile_id, r.reported_profile_id]).filter((v): v is string => Boolean(v)),
    ),
  ];

  const [postsRes, profilesRes] = await Promise.all([
    postIds.length > 0
      ? sb.from('community_posts').select('id, body, author_profile_id').eq('company_id', companyId).in('id', postIds)
      : Promise.resolve({ data: [] }),
    profileIds.length > 0
      ? sb.from('profiles').select('id, full_name, email').in('id', profileIds)
      : Promise.resolve({ data: [] }),
  ]);

  const posts = new Map(
    ((postsRes.data ?? []) as { id: string; body: string | null; author_profile_id: string | null }[]).map((p) => [p.id, p]),
  );
  const people = new Map(
    ((profilesRes.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [
      p.id,
      p.full_name?.trim() || p.email || `${p.id.slice(0, 8)}...`,
    ]),
  );

  const rows: ReportRow[] = raw.map((r) => {
    const post = posts.get(r.post_id);
    const body = (post?.body ?? '').trim();
    const authorId = post?.author_profile_id ?? r.reported_profile_id;
    return {
      id: r.id,
      postId: r.post_id,
      postBody: body.length > PREVIEW_CHARS ? `${body.slice(0, PREVIEW_CHARS)}...` : body || '(post deleted)',
      postAuthorName: authorId ? (people.get(authorId) ?? 'unknown') : 'unknown',
      reportedProfileId: r.reported_profile_id,
      reporterName: r.reporter_profile_id ? (people.get(r.reporter_profile_id) ?? 'unknown') : 'deleted account',
      reason: r.reason,
      note: r.note,
      status: r.status,
      createdAt: r.created_at,
    };
  });

  const reasonCounts = new Map<ReportReason, number>();
  for (const row of (reasonRes.data ?? []) as { reason: ReportReason }[]) {
    reasonCounts.set(row.reason, (reasonCounts.get(row.reason) ?? 0) + 1);
  }
  const topReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    rows,
    kpi: {
      open: openRes.count ?? 0,
      dismissed7d: dismissedRes.count ?? 0,
      actioned7d: actionedRes.count ?? 0,
      topReasons,
    },
  };
}

export const REASON_LABEL: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  self_harm: 'Self-harm',
  nudity: 'Nudity',
  misinformation: 'Misinformation',
  other: 'Other',
};
