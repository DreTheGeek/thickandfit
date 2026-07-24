import 'server-only';
// K6: auto-promote real member corrections into "silver" eval cases so the offline eval set grows
// with real production photos over time. Ports the from-corrections mode of
// scripts/eval/seed-smart-scan-eval.mjs into a lib the internal cron can hit weekly.
//
// Signal: an ai_inferences row is a candidate when:
//   * feature = 'photo-scan'
//   * corrected_at is not null (the member edited at least one item)
//   * its persisted scan image exists at ai-scans/<inference_id>.jpg (feat: scan persistence)
//
// Ground truth per item: corrected grams when the member changed it; predicted grams when accepted.
// Tagged expected.source='correction-join' so the eval runner keeps gold and silver scored separately.
// Silver cases never overwrite golden ones (unique-ish on input.storage_path per eval).
import { createServiceClient } from '@/lib/supabase/service';

const EVAL_NAME = 'smart-scan-golden-v1';
const BUCKET = 'food-photos';
const LOOKBACK = 100;

export type MineResult = {
  ok: boolean;
  scanned: number;      // candidate inferences considered
  proposed: number;     // unique unseen scans with usable labels
  added: number;        // inserted rows this run
  alreadySeen: number;  // storage_paths that already had a case
  imageMissing: number; // proposals where the persisted scan image was never uploaded
  ranAtIso: string;
};

type CorrectionItem = { predicted_name?: string; corrected_name?: string; predicted_grams?: number; corrected_grams?: number };
type InferenceRow = { id: string; correction: { items?: CorrectionItem[] } | null; company_id: string };

export async function mineSilverScanCases(): Promise<MineResult> {
  const ranAtIso = new Date().toISOString();
  const sb = createServiceClient();

  // Resolve the eval row (created by the golden seed already; we only mine INTO an existing eval).
  const { data: evalRow } = await sb.from('ai_evals').select('id, company_id').eq('name', EVAL_NAME).maybeSingle();
  if (!evalRow) {
    return { ok: false, scanned: 0, proposed: 0, added: 0, alreadySeen: 0, imageMissing: 0, ranAtIso };
  }
  const ev = evalRow as { id: string; company_id: string };

  // Existing case storage_paths — dedupe so a re-run never inserts the same silver case twice.
  const { data: existing } = await sb.from('ai_eval_cases').select('input').eq('ai_eval_id', ev.id);
  const seen = new Set<string>();
  for (const c of (existing ?? []) as { input: { storage_path?: string } | null }[]) {
    const p = c.input?.storage_path;
    if (p) seen.add(p);
  }

  // Recent corrected photo scans.
  const { data: infs } = await sb
    .from('ai_inferences')
    .select('id, correction, company_id')
    .eq('feature', 'photo-scan')
    .not('corrected_at', 'is', null)
    .order('corrected_at', { ascending: false })
    .limit(LOOKBACK);

  const inferences = (infs ?? []) as InferenceRow[];
  let proposed = 0;
  let added = 0;
  let alreadySeen = 0;
  let imageMissing = 0;

  for (const inf of inferences) {
    const items = Array.isArray(inf.correction?.items) ? inf.correction.items : [];
    const labeled = items
      .filter((i) => i.predicted_name && (i.corrected_grams ?? i.predicted_grams))
      .map((i) => ({
        name: i.corrected_name || i.predicted_name!,
        grams: (i.corrected_grams ?? i.predicted_grams) as number,
      }));
    if (labeled.length === 0) continue;

    const storagePath = `ai-scans/${inf.id}.jpg`;
    if (seen.has(storagePath)) {
      alreadySeen += 1;
      continue;
    }

    // Only silver-promote when the raw image is actually present in storage (otherwise the eval
    // has no pixels to replay against). One HEAD-equivalent per candidate; cheap for LOOKBACK=100.
    const dl = await sb.storage.from(BUCKET).download(storagePath);
    if (dl.error || !dl.data) {
      imageMissing += 1;
      continue;
    }
    proposed += 1;

    const { error } = await sb.from('ai_eval_cases').insert({
      company_id: ev.company_id,
      ai_eval_id: ev.id,
      input: { storage_path: storagePath, locale: 'en' },
      expected: { kind: 'meal', items: labeled, source: 'correction-join' },
    });
    if (!error) {
      added += 1;
      seen.add(storagePath); // prevent same-run duplicates on unusual concurrent inserts
    }
  }

  return {
    ok: true,
    scanned: inferences.length,
    proposed,
    added,
    alreadySeen,
    imageMissing,
    ranAtIso,
  };
}
