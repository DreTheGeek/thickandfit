// Server reads for the lesson library.
//
// Service client (server-only), matching the rest of the coach surface: company_id is pinned by the
// caller from the auth context, never from searchParams. RLS on these tables is coach-scoped and the
// service client bypasses it, so the explicit .eq('company_id', ...) on every query IS the tenant
// boundary. Removing one is a cross-tenant leak, not a missing filter.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { demoUrls } from '@/lib/exercises/demo-url';
import type {
  LessonAsset,
  LessonAssetKind,
  LessonDetail,
  LessonEsStatus,
  LessonPlanSummary,
  LessonSummary,
} from '@/lib/lessons/types';

type LessonRow = {
  id: string;
  slug: string;
  title_en: string;
  body_html_en: string | null;
  category: string | null;
  es_status: string;
  is_published: boolean;
  sort_order: number;
};

type AssetRow = {
  id: string;
  lesson_id: string;
  kind: string;
  storage_path: string;
  mime_type: string | null;
  duration_seconds: number | null;
  bytes: number | null;
  sort_order: number;
};

const asEsStatus = (v: string): LessonEsStatus =>
  v === 'approved' || v === 'draft' ? v : 'missing';

const fileNameOf = (storagePath: string): string => storagePath.split('/').pop() ?? storagePath;

/**
 * Send counts per lesson.
 *
 * A grouped count would be one query in SQL, but PostgREST has no GROUP BY, and 24 lessons is small
 * enough that pulling the ids and counting here is cheaper than 24 head-count round trips. If the
 * library ever grows past a few hundred this becomes an RPC.
 */
async function sendCounts(companyId: string): Promise<Map<string, number>> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('lesson_sends')
    .select('lesson_id, contact_id')
    .eq('company_id', companyId)
    .limit(20000);
  const perLesson = new Map<string, Set<string>>();
  for (const r of (data ?? []) as { lesson_id: string; contact_id: string }[]) {
    if (!perLesson.has(r.lesson_id)) perLesson.set(r.lesson_id, new Set());
    perLesson.get(r.lesson_id)!.add(r.contact_id);
  }
  // Distinct CLIENTS, not rows. She cares how many people got it, and a resend would otherwise
  // inflate the number.
  return new Map([...perLesson].map(([k, v]) => [k, v.size]));
}

export async function listLessons(companyId: string): Promise<LessonSummary[]> {
  const sb = createServiceClient();
  const [{ data: lessonRows }, { data: assetRows }, counts] = await Promise.all([
    sb
      .from('lessons')
      .select('id, slug, title_en, body_html_en, category, es_status, is_published, sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true }),
    sb
      .from('lesson_assets')
      .select('id, lesson_id, kind, storage_path, mime_type, duration_seconds, bytes, sort_order')
      .eq('company_id', companyId),
    sendCounts(companyId),
  ]);

  const lessons = (lessonRows ?? []) as LessonRow[];
  const assets = (assetRows ?? []) as AssetRow[];

  // Sign the covers in ONE round trip rather than one per card.
  const coverPaths = assets.filter((a) => a.kind === 'cover').map((a) => a.storage_path);
  const signed = await demoUrls(coverPaths);

  const byLesson = new Map<string, AssetRow[]>();
  for (const a of assets) {
    if (!byLesson.has(a.lesson_id)) byLesson.set(a.lesson_id, []);
    byLesson.get(a.lesson_id)!.push(a);
  }

  return lessons.map((l) => {
    const mine = byLesson.get(l.id) ?? [];
    const cover = mine.find((a) => a.kind === 'cover');
    return {
      id: l.id,
      slug: l.slug,
      title: l.title_en,
      category: l.category,
      esStatus: asEsStatus(l.es_status),
      isPublished: l.is_published,
      videoCount: mine.filter((a) => a.kind === 'video').length,
      documentCount: mine.filter((a) => a.kind === 'document').length,
      sentCount: counts.get(l.id) ?? 0,
      coverUrl: cover ? (signed.get(cover.storage_path) ?? null) : null,
    };
  });
}

export async function getLesson(companyId: string, lessonId: string): Promise<LessonDetail | null> {
  const sb = createServiceClient();
  const { data: row } = await sb
    .from('lessons')
    .select('id, slug, title_en, body_html_en, category, es_status, is_published, sort_order')
    .eq('company_id', companyId)
    .eq('id', lessonId)
    .maybeSingle<LessonRow>();
  if (!row) return null;

  const [{ data: assetRows }, { data: planRows }, counts] = await Promise.all([
    sb
      .from('lesson_assets')
      .select('id, lesson_id, kind, storage_path, mime_type, duration_seconds, bytes, sort_order')
      .eq('company_id', companyId)
      .eq('lesson_id', lessonId)
      .order('sort_order', { ascending: true }),
    sb
      .from('lesson_plan_items')
      .select('lesson_plans(name_en)')
      .eq('company_id', companyId)
      .eq('lesson_id', lessonId),
    sendCounts(companyId),
  ]);

  const assets = (assetRows ?? []) as AssetRow[];
  const signed = await demoUrls(assets.map((a) => a.storage_path));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title_en,
    bodyHtml: row.body_html_en,
    category: row.category,
    esStatus: asEsStatus(row.es_status),
    isPublished: row.is_published,
    sentCount: counts.get(row.id) ?? 0,
    // PostgREST types an embedded to-one relation as an ARRAY, so flatten before reading the name.
    planNames: ((planRows ?? []) as { lesson_plans: { name_en: string }[] | { name_en: string } | null }[])
      .flatMap((p) => (Array.isArray(p.lesson_plans) ? p.lesson_plans : p.lesson_plans ? [p.lesson_plans] : []))
      .map((p) => p.name_en)
      .filter((n): n is string => Boolean(n)),
    assets: assets.map(
      (a): LessonAsset => ({
        id: a.id,
        kind: a.kind as LessonAssetKind,
        url: signed.get(a.storage_path) ?? null,
        mimeType: a.mime_type,
        durationSeconds: a.duration_seconds,
        bytes: a.bytes,
        fileName: fileNameOf(a.storage_path),
      }),
    ),
  };
}

export async function listLessonPlans(companyId: string): Promise<LessonPlanSummary[]> {
  const sb = createServiceClient();
  const [{ data: planRows }, { data: itemRows }] = await Promise.all([
    sb
      .from('lesson_plans')
      .select('id, name_en, sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true }),
    sb.from('lesson_plan_items').select('lesson_plan_id').eq('company_id', companyId),
  ]);
  const counts = new Map<string, number>();
  for (const r of (itemRows ?? []) as { lesson_plan_id: string }[]) {
    counts.set(r.lesson_plan_id, (counts.get(r.lesson_plan_id) ?? 0) + 1);
  }
  return ((planRows ?? []) as { id: string; name_en: string }[]).map((p) => ({
    id: p.id,
    name: p.name_en,
    lessonCount: counts.get(p.id) ?? 0,
  }));
}
