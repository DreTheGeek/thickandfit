// Pure, client-safe types + filter parsing for the Leads pipeline. Re-exported by leads.ts.
import type { Bucket, TagLite } from '@/lib/coach/clients-types';
import type { LeadStatus } from '@/lib/coach/lead-standing';

export type LeadView = 'board' | 'list';
export type LeadSort = 'value' | 'created' | 'updated' | 'name';

export type LeadFilters = {
  q: string;
  pipeline: string | null; // slug: marketing | reengagement
  status: string[];
  stage: string[];
  owner: string[];
  source: string[];
  tags: string[];
  view: LeadView;
  sort: LeadSort;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
  segment: string | null;
};

export type LeadCardRow = {
  id: string;
  name: string;
  initials: string;
  contactId: string | null;
  email: string | null;
  phone: string | null;
  valueCents: number | null;
  currency: string;
  status: LeadStatus;
  stageId: string | null;
  stageName: string;
  source: string | null;
  owner: string | null;
  daysInStage: number | null;
  tags: TagLite[];
  createdAt: string | null;
};

export type LeadTimelineEntry = { field: string; from: string | null; to: string | null; source: string; at: string };

export type LeadDetail = {
  id: string;
  name: string;
  initials: string;
  contactId: string | null;
  ghlContactId: string | null;
  email: string | null;
  phone: string | null;
  owner: string | null;
  language: string | null;
  status: LeadStatus;
  valueCents: number | null;
  currency: string;
  pipelineName: string | null;
  stageName: string | null;
  source: string | null;
  lostReason: string | null;
  forecastProbability: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  daysInStage: number | null;
  tags: TagLite[];
  timeline: LeadTimelineEntry[];
};

export type StageColumn = { id: string; name: string; position: number; cards: LeadCardRow[]; count: number; valueCents: number };
export type PipelineMeta = { id: string; slug: string; name: string };
export type LeadKpis = {
  open: number;
  won: number;
  lost: number;
  total: number;
  openValueCents: number;
  wonValueCents: number;
  winRatePct: number;
};

export type PipelineBoard = {
  pipelines: PipelineMeta[];
  activeSlug: string;
  columns: StageColumn[];
  shownCount: number;
  kpis: LeadKpis;
  statusCounts: Bucket[];
  ownerCounts: Bucket[];
  sourceCounts: Bucket[];
};

export const COLUMN_CARD_CAP = 60;

const VIEWS: readonly LeadView[] = ['board', 'list'];
const SORTS: readonly LeadSort[] = ['value', 'created', 'updated', 'name'];

function toArr(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).filter((s) => typeof s === 'string' && s.length > 0);
}

export function parseLeadFilters(raw: Record<string, string | string[] | undefined>): LeadFilters {
  const view = VIEWS.includes(raw.view as LeadView) ? (raw.view as LeadView) : 'board';
  const sortRaw = typeof raw.sort === 'string' ? raw.sort : '';
  const sort = SORTS.includes(sortRaw as LeadSort) ? (sortRaw as LeadSort) : 'value';
  return {
    q: typeof raw.q === 'string' ? raw.q.trim().slice(0, 80) : '',
    pipeline: typeof raw.pipeline === 'string' ? raw.pipeline : null,
    status: toArr(raw.status),
    stage: toArr(raw.stage),
    owner: toArr(raw.owner),
    source: toArr(raw.source),
    tags: toArr(raw.tags),
    view,
    sort,
    dir: raw.dir === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Math.floor(Number(raw.page)) || 1),
    pageSize: Math.min(100, Math.max(10, Math.floor(Number(raw.pageSize)) || 50)),
    segment: typeof raw.segment === 'string' ? raw.segment : null,
  };
}
