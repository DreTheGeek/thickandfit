// Shapes for the lessons surface.
//
// A lesson is a short piece of teaching she sends a client: a video, a document, or both, with an
// optional written note. Recovered from Lenus on 2026-08-12 (migration 0133).

export type LessonAssetKind = 'video' | 'document' | 'cover';
export type LessonEsStatus = 'missing' | 'draft' | 'approved';

export type LessonAsset = {
  id: string;
  kind: LessonAssetKind;
  /**
   * A short-lived signed URL, minted server-side. The storage path itself never reaches the
   * browser: the bucket is private, and keeping the path out of the DOM means there is nothing to
   * enumerate the library from. Null when the object is missing, which the UI shows honestly
   * rather than handing the browser a link that 404s.
   */
  url: string | null;
  mimeType: string | null;
  durationSeconds: number | null;
  bytes: number | null;
  /** Filename, for the download link's label. Derived from the path, not a stored column. */
  fileName: string;
};

export type LessonSummary = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  esStatus: LessonEsStatus;
  isPublished: boolean;
  videoCount: number;
  documentCount: number;
  /** How many clients she has already sent this to, from the migrated Lenus history. */
  sentCount: number;
  coverUrl: string | null;
};

export type LessonDetail = {
  id: string;
  slug: string;
  title: string;
  bodyHtml: string | null;
  category: string | null;
  esStatus: LessonEsStatus;
  isPublished: boolean;
  assets: LessonAsset[];
  sentCount: number;
  /** The drip sequences this lesson belongs to, by name. */
  planNames: string[];
};

export type LessonPlanSummary = {
  id: string;
  name: string;
  lessonCount: number;
};

/** Bytes to something a human reads. Whole MB above a megabyte; nothing here is smaller than a KB. */
export function formatBytes(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes >= 1_048_576) return `${Math.round(bytes / 1_048_576)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Seconds to m:ss. Her lesson videos run from about 40 seconds to a little over ten minutes. */
export function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
