// One-way GHL -> Supabase sync of pipelines + opportunities. Idempotent (upsert on ghl ids).
// Usage: node .qa-visual/ghl-sync.cjs        (dry run, no writes)
//        node .qa-visual/ghl-sync.cjs apply  (writes)
const path = require('path');
const fs = require('fs');
const { createClient } = require(path.join(process.cwd(), 'node_modules/@supabase/supabase-js'));

const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
});
const APPLY = process.argv[2] === 'apply';
const H = { Authorization: `Bearer ${env.GHL_API_TOKEN}`, Version: '2021-07-28', Accept: 'application/json' };
const LOC = env.GHL_LOCATION_ID;
const BASE = 'https://services.leadconnectorhq.com';
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ghl(pathname) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`${BASE}${pathname}`, { headers: H });
    if (r.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
    const t = await r.text();
    if (!r.ok) throw new Error(`GHL ${r.status}: ${t.slice(0, 160)}`);
    return JSON.parse(t);
  }
  throw new Error('GHL rate limited');
}

(async () => {
  const { data: co, error: coErr } = await sb.from('companies').select('id').eq('slug', 'thick-and-fit').single();
  if (coErr || !co) throw new Error('company thick-and-fit not found: ' + (coErr?.message ?? 'no row'));
  const companyId = co.id;
  const nn = (v) => (v === '' || v == null ? null : v);
  console.log('company:', companyId, '| mode:', APPLY ? 'APPLY' : 'DRY RUN', '\n');

  // 1) pipelines + stages
  const pl = await ghl(`/opportunities/pipelines?locationId=${LOC}`);
  const pipes = pl.pipelines || [];
  const pipeMap = {};
  const stageMap = {};
  if (APPLY) {
    const { data: pr, error: pe } = await sb
      .from('pipelines')
      .upsert(pipes.map((p) => ({ company_id: companyId, ghl_pipeline_id: p.id, name: p.name, raw: p })), { onConflict: 'company_id,ghl_pipeline_id' })
      .select('id, ghl_pipeline_id');
    if (pe) throw new Error('pipelines: ' + pe.message);
    pr.forEach((r) => (pipeMap[r.ghl_pipeline_id] = r.id));
    const stageRows = [];
    pipes.forEach((p) => (p.stages || []).forEach((s, i) => stageRows.push({ company_id: companyId, pipeline_id: pipeMap[p.id], ghl_stage_id: s.id, name: s.name, position: i })));
    const { data: sr, error: se } = await sb.from('pipeline_stages').upsert(stageRows, { onConflict: 'company_id,ghl_stage_id' }).select('id, ghl_stage_id');
    if (se) throw new Error('stages: ' + se.message);
    sr.forEach((r) => (stageMap[r.ghl_stage_id] = r.id));
  }
  console.log('pipelines:', pipes.length, '| stages:', pipes.reduce((a, p) => a + (p.stages || []).length, 0));

  // 2) all opportunities (cursor loop)
  const opps = [];
  let cursor = '';
  for (let i = 0; i < 50; i++) {
    const page = await ghl(`/opportunities/search?location_id=${LOC}&limit=100${cursor}`);
    const batch = page.opportunities || [];
    opps.push(...batch);
    const meta = page.meta || {};
    // batch length is the primary continuation signal; meta.total is advisory (can be 0/omitted)
    if (batch.length < 100 || !meta.startAfterId) break;
    const nextCursor = `&startAfter=${meta.startAfter}&startAfterId=${meta.startAfterId}`;
    if (nextCursor === cursor) break;
    cursor = nextCursor;
    await sleep(200);
  }
  console.log('opportunities fetched:', opps.length);

  // 3) contact link map (by email)
  const { data: contacts, error: cErr } = await sb.from('contacts').select('id, email, ghl_contact_id').eq('company_id', companyId).limit(20000);
  if (cErr) throw new Error('contacts: ' + cErr.message);
  if ((contacts || []).length >= 20000) console.warn('WARN: contacts cap reached; linking may be incomplete');
  const emailMap = new Map((contacts || []).filter((c) => c.email).map((c) => [c.email.toLowerCase(), c.id]));
  const ghlIdMap = new Map((contacts || []).filter((c) => c.ghl_contact_id).map((c) => [c.ghl_contact_id, c.id]));

  // 4) map rows
  let linked = 0;
  let unmatched = 0;
  const cents = [];
  const rows = opps.map((o) => {
    const email = o.contact && o.contact.email ? o.contact.email.toLowerCase() : null;
    // primary link key is ghl_contact_id (reliable top-level field); email is the fallback
    const contactId = (o.contactId && ghlIdMap.get(o.contactId)) || (email && emailMap.get(email)) || null;
    if (contactId) linked++; else unmatched++;
    const n = Number(o.monetaryValue);
    const mv = Number.isFinite(n) ? Math.round(n * 100) : 0;
    cents.push({ raw: o.monetaryValue, cents: mv });
    return {
      company_id: companyId,
      contact_id: contactId,
      ghl_opportunity_id: o.id,
      ghl_contact_id: o.contactId ?? null,
      name: o.name ?? null,
      pipeline_id: pipeMap[o.pipelineId] ?? null,
      stage_id: stageMap[o.pipelineStageId] ?? null,
      status: ['open', 'won', 'lost', 'abandoned'].includes(o.status) ? o.status : 'open',
      monetary_value_cents: mv,
      forecast_probability: nn(o.forecastProbability),
      source: o.source ?? null,
      lost_reason_id: o.lostReasonId ?? null,
      lost_reason: o.lostReasonName ?? o.lostReason ?? null,
      assigned_to: o.assignedTo ?? null,
      ghl_created_at: nn(o.createdAt),
      ghl_updated_at: nn(o.updatedAt),
      last_stage_change_at: nn(o.lastStageChangeAt),
      last_status_change_at: nn(o.lastStatusChangeAt),
      raw: o,
      synced_at: new Date().toISOString(),
    };
  });

  const byStatus = rows.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  const wonValue = rows.filter((r) => r.status === 'won').reduce((a, r) => a + r.monetary_value_cents, 0);
  console.log('\n=== MAPPING PREVIEW ===');
  console.log('by status:', JSON.stringify(byStatus));
  console.log('linked to a contact:', linked, '| unmatched (contact_id null):', unmatched);
  console.log('sample monetaryValue -> cents:', JSON.stringify(cents.slice(0, 6)));
  console.log('won pipeline value: $' + Math.round(wonValue / 100).toLocaleString('en-US'));

  if (!APPLY) { console.log('\nDRY RUN - no writes. Re-run with `apply` to upsert.'); return; }

  // 5) upsert opportunities in batches
  let written = 0;
  for (let i = 0; i < rows.length; i += 300) {
    const chunk = rows.slice(i, i + 300);
    const { error } = await sb.from('opportunities').upsert(chunk, { onConflict: 'company_id,ghl_opportunity_id' });
    if (error) throw new Error(`opp upsert @${i}: ${error.message}`);
    written += chunk.length;
  }
  console.log('\nupserted opportunities:', written);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
