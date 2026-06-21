// Probe the GoHighLevel (LeadConnector v2) API with the stored PIT token.
// Inventory only: counts + field/tag/pipeline names + a PII-masked sample. No bulk PII dump.
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
});
const TOKEN = env.GHL_API_TOKEN;
const LOC = env.GHL_LOCATION_ID;
const BASE = 'https://services.leadconnectorhq.com';
const H = { Authorization: `Bearer ${TOKEN}`, Version: '2021-07-28', Accept: 'application/json' };

async function get(pathname) {
  const r = await fetch(`${BASE}${pathname}`, { headers: H });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return { status: r.status, body };
}
const mask = (s) => (typeof s === 'string' && s ? s.slice(0, 2) + '***' : s);

(async () => {
  console.log('loc:', LOC, '\n');

  // 1) contacts: total + sample shape
  const c = await get(`/contacts/?locationId=${LOC}&limit=1`);
  console.log('=== CONTACTS ===', 'status', c.status);
  if (c.body && c.body.meta) console.log('total:', c.body.meta.total);
  const sample = c.body && c.body.contacts && c.body.contacts[0];
  if (sample) {
    console.log('contact keys:', Object.keys(sample).join(', '));
    console.log('sample:', JSON.stringify({
      name: mask(sample.contactName || sample.firstName),
      email: mask(sample.email),
      phone: mask(sample.phone),
      tags: sample.tags,
      type: sample.type,
      source: sample.source,
      dateAdded: sample.dateAdded,
      customFields: Array.isArray(sample.customFields) ? sample.customFields.length + ' custom values' : sample.customFields,
    }));
  }

  // 2) custom fields (for mapping)
  const cf = await get(`/locations/${LOC}/customFields`);
  console.log('\n=== CUSTOM FIELDS ===', 'status', cf.status);
  const fields = (cf.body && (cf.body.customFields || cf.body.customField)) || [];
  console.log('count:', Array.isArray(fields) ? fields.length : 'n/a');
  if (Array.isArray(fields)) fields.slice(0, 40).forEach((f) => console.log(`  ${f.name} [${f.dataType}] (${f.fieldKey || f.id})`));

  // 3) tags
  const tg = await get(`/locations/${LOC}/tags`);
  console.log('\n=== TAGS ===', 'status', tg.status);
  const tags = (tg.body && tg.body.tags) || [];
  console.log('count:', Array.isArray(tags) ? tags.length : 'n/a');
  if (Array.isArray(tags)) console.log('  ', tags.slice(0, 50).map((t) => t.name).join(' | '));

  // 4) pipelines + opportunities
  const pl = await get(`/opportunities/pipelines?locationId=${LOC}`);
  console.log('\n=== PIPELINES ===', 'status', pl.status);
  const pipes = (pl.body && pl.body.pipelines) || [];
  if (Array.isArray(pipes)) pipes.forEach((p) => console.log(`  ${p.name}: stages -> ${(p.stages || []).map((s) => s.name).join(', ')}`));

  const op = await get(`/opportunities/search?location_id=${LOC}&limit=1`);
  console.log('\n=== OPPORTUNITIES ===', 'status', op.status);
  if (op.body && op.body.meta) console.log('total:', op.body.meta.total);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
