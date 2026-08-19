#!/usr/bin/env node

// Resumable embedding backfill for public.foods.
// Run after migration 0145. It only selects rows with embedding IS NULL, writes in small batches,
// and can be interrupted/restarted without touching completed rows.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openRouterKey = process.env.OPENROUTER_API_KEY;
const model = 'openai/text-embedding-3-small';
const dims = 1536;
const pageSize = Math.max(1, Math.min(Number(process.env.FOOD_EMBED_BATCH ?? 25), 100));

if (!supabaseUrl || !serviceKey || !openRouterKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENROUTER_API_KEY');
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function embed(input) {
  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`embedding HTTP ${res.status}: ${(await res.text()).slice(0, 250)}`);
  const json = await res.json();
  const vector = json?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== dims) {
    throw new Error(`unexpected embedding dimensions: ${Array.isArray(vector) ? vector.length : 'none'}`);
  }
  return vector;
}

let processed = 0;
let failed = 0;
for (;;) {
  const { data: rows, error } = await sb
    .from('foods')
    .select('id,name_en,name_es,brand,category,source,search_text')
    .is('embedding', null)
    .order('created_at', { ascending: true })
    .limit(pageSize);
  if (error) throw error;
  if (!rows?.length) break;

  for (const row of rows) {
    const text = [row.name_en, row.name_es, row.brand, row.category, row.search_text]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 2000);
    try {
      const vector = await embed(text);
      const { error: updateError } = await sb
        .from('foods')
        .update({ embedding: vector })
        .eq('id', row.id)
        .is('embedding', null);
      if (updateError) throw updateError;
      processed += 1;
      console.log(`[food-embed] ${processed} ${row.id} ${row.name_en}`);
    } catch (err) {
      failed += 1;
      console.error(`[food-embed] FAIL ${row.id} ${row.name_en}:`, err instanceof Error ? err.message : err);
      // Do not spin forever on one bad row in this run. Marking is intentionally not persisted because
      // a provider outage is retryable. The process exits non-zero below so the operator sees it.
      // Skip this row by continuing through the current page, then stop after the page finishes.
    }
  }

  if (failed > 0) break;
}

const { count, error: countError } = await sb
  .from('foods')
  .select('id', { head: true, count: 'exact' })
  .is('embedding', null);
if (countError) throw countError;

console.log(JSON.stringify({ ok: failed === 0 && count === 0, processed, failed, remaining: count ?? null }, null, 2));
if (failed > 0 || (count ?? 0) > 0) process.exitCode = 1;
