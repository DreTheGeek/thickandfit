// Probe GHL opportunity + pipeline shape for the Leads-pipeline build. Shape only, PII masked.
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
});
const H = { Authorization: `Bearer ${env.GHL_API_TOKEN}`, Version: '2021-07-28', Accept: 'application/json' };
const LOC = env.GHL_LOCATION_ID;
const BASE = 'https://services.leadconnectorhq.com';
const get = async (p) => { const r = await fetch(`${BASE}${p}`, { headers: H }); const t = await r.text(); try { return { s: r.status, b: JSON.parse(t) }; } catch { return { s: r.status, b: t.slice(0, 200) }; } };

(async () => {
  const pl = await get(`/opportunities/pipelines?locationId=${LOC}`);
  console.log('=== PIPELINES (with stage ids) ===');
  for (const p of pl.b.pipelines || []) {
    console.log(`\n# ${p.name} (${p.id})`);
    for (const s of p.stages || []) console.log(`   - ${s.name} (${s.id})`);
  }
  const op = await get(`/opportunities/search?location_id=${LOC}&limit=2`);
  console.log('\n=== OPPORTUNITY shape ===', 'status', op.s, 'total', op.b.meta && op.b.meta.total);
  const o = op.b.opportunities && op.b.opportunities[0];
  if (o) {
    console.log('keys:', Object.keys(o).join(', '));
    console.log('sample:', JSON.stringify({
      name: o.name ? o.name.slice(0, 3) + '***' : null,
      status: o.status, pipelineId: o.pipelineId, stageId: o.pipelineStageId,
      monetaryValue: o.monetaryValue, source: o.source, createdAt: o.createdAt, updatedAt: o.updatedAt,
      contactId: o.contactId ? 'set' : null, assignedTo: o.assignedTo ? 'set' : null,
    }));
  }
  // status distribution
  const byStatus = {};
  for (const st of ['open', 'won', 'lost', 'abandoned']) {
    const r = await get(`/opportunities/search?location_id=${LOC}&status=${st}&limit=1`);
    byStatus[st] = r.b.meta ? r.b.meta.total : r.s;
  }
  console.log('\n=== OPPORTUNITY counts by status ===', JSON.stringify(byStatus));
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
