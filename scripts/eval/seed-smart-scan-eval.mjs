// Golden-set seeder for the smart-scan eval. Two modes:
//
// 1) MANIFEST (primary, gold): a folder of photos + manifest.json of human labels.
//      pnpm eval:seed -- --dir "Build/00-research/eval-cases"
//    manifest.json shape:
//      [{ "file": "meal-01.jpg", "locale": "en", "kind": "meal",
//         "items": [{ "name": "cooked white rice", "grams": 250 }, ...] }, ...]
//    Photos upload to the private food-photos bucket under ai-evals/smart-scan/<file> (service role;
//    the reserved top-level folder can never collide with auth.uid() owner folders). Idempotent:
//    cases whose storage_path already exists are skipped.
//
// 2) FROM CORRECTIONS (silver, provisional): proposes cases from real corrected photo scans whose
//    image was persisted (ai-scans/<inference_id>.jpg, feat: scan persistence). The user's corrected
//    grams are the label. Requires --confirm to write; prints the proposals otherwise. These are
//    tagged expected.source='correction-join' so the runner reports gold vs silver separately.
//      pnpm eval:seed -- --from-corrections [--confirm]
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (via node --env-file=.env.local).
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}
const sb = createClient(URL, KEY);

const EVAL_NAME = 'smart-scan-golden-v1';
const BUCKET = 'food-photos';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

async function getOrCreateEval() {
  const { data: company } = await sb.from('companies').select('id').limit(1).single();
  if (!company) throw new Error('no company row');
  const { data: existing } = await sb
    .from('ai_evals')
    .select('id, company_id')
    .eq('feature', 'photo-scan')
    .eq('name', EVAL_NAME)
    .maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await sb
    .from('ai_evals')
    .insert({ company_id: company.id, feature: 'photo-scan', name: EVAL_NAME })
    .select('id, company_id')
    .single();
  if (error) throw new Error(`create eval: ${error.message}`);
  return created;
}

async function existingPaths(evalId) {
  const { data } = await sb.from('ai_eval_cases').select('input').eq('ai_eval_id', evalId);
  return new Set((data ?? []).map((r) => r.input?.storage_path).filter(Boolean));
}

async function seedFromManifest(dir) {
  const abs = resolve(dir);
  const manifestPath = join(abs, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`No manifest.json in ${abs}`);
    console.error('Expected: [{ "file": "meal-01.jpg", "locale": "en", "kind": "meal", "items": [{ "name": "...", "grams": 250 }] }]');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const ev = await getOrCreateEval();
  const seen = await existingPaths(ev.id);

  let added = 0;
  let skipped = 0;
  for (const entry of manifest) {
    if (!entry.file || !Array.isArray(entry.items) || !entry.items.length) {
      console.warn(`skipping invalid entry: ${JSON.stringify(entry).slice(0, 100)}`);
      continue;
    }
    const storagePath = `ai-evals/smart-scan/${entry.file}`;
    if (seen.has(storagePath)) {
      skipped += 1;
      continue;
    }
    const filePath = join(abs, entry.file);
    if (!existsSync(filePath)) {
      console.warn(`photo missing on disk, skipping: ${entry.file}`);
      continue;
    }
    const bytes = readFileSync(filePath);
    const ext = entry.file.split('.').pop().toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const up = await sb.storage.from(BUCKET).upload(storagePath, bytes, { contentType, upsert: true });
    if (up.error) {
      console.error(`upload failed ${entry.file}: ${up.error.message}`);
      continue;
    }
    const { error } = await sb.from('ai_eval_cases').insert({
      company_id: ev.company_id,
      ai_eval_id: ev.id,
      input: { storage_path: storagePath, locale: entry.locale === 'es' ? 'es' : 'en' },
      expected: { kind: entry.kind === 'product' ? 'product' : 'meal', items: entry.items, source: 'manifest' },
    });
    if (error) {
      console.error(`case insert failed ${entry.file}: ${error.message}`);
      continue;
    }
    added += 1;
    console.log(`added: ${entry.file} (${entry.items.length} labeled items)`);
  }
  console.log(`\nDone. ${added} added, ${skipped} already present.`);
}

async function seedFromCorrections(confirm) {
  const ev = await getOrCreateEval();
  const seen = await existingPaths(ev.id);
  // Corrected photo-scan inferences whose scan image was persisted (feat: scan persistence).
  const { data: inferences } = await sb
    .from('ai_inferences')
    .select('id, correction, corrected_at')
    .eq('feature', 'photo-scan')
    .not('corrected_at', 'is', null)
    .order('corrected_at', { ascending: false })
    .limit(100);

  const proposals = [];
  for (const inf of inferences ?? []) {
    const items = Array.isArray(inf.correction?.items) ? inf.correction.items : [];
    // The user's final truth per item: corrected grams when changed, predicted grams when accepted.
    const labeled = items
      .filter((i) => i.predicted_name && (i.corrected_grams ?? i.predicted_grams))
      .map((i) => ({ name: i.corrected_name || i.predicted_name, grams: i.corrected_grams ?? i.predicted_grams }));
    if (!labeled.length) continue;
    const storagePath = `ai-scans/${inf.id}.jpg`;
    if (seen.has(storagePath)) continue;
    const head = await sb.storage.from(BUCKET).download(storagePath);
    if (head.error || !head.data) continue; // image was never persisted for this scan
    proposals.push({ storagePath, items: labeled });
  }

  if (!proposals.length) {
    console.log('No corrected scans with persisted images found yet. They accumulate as members correct scans.');
    return;
  }
  console.log(`Proposed silver cases (${proposals.length}):`);
  for (const p of proposals) console.log(`  ${p.storagePath}: ${p.items.map((i) => `${i.name} ${i.grams}g`).join(', ')}`);
  if (!confirm) {
    console.log('\nDry run. Re-run with --confirm to write these as silver eval cases.');
    return;
  }
  let added = 0;
  for (const p of proposals) {
    const { error } = await sb.from('ai_eval_cases').insert({
      company_id: ev.company_id,
      ai_eval_id: ev.id,
      input: { storage_path: p.storagePath, locale: 'en' },
      expected: { kind: 'meal', items: p.items, source: 'correction-join' },
    });
    if (!error) added += 1;
  }
  console.log(`\n${added} silver cases written.`);
}

if (flag('from-corrections')) {
  await seedFromCorrections(flag('confirm'));
} else {
  const dir = arg('dir', 'Build/00-research/eval-cases');
  await seedFromManifest(dir);
}
