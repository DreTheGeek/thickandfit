// WP13 legacy progress-photo import (QA / proof-of-mechanics runner).
//
// Idempotently copies a CLAIMED legacy client's Lenus progress photos (public pub-*.r2.dev URLs in
// lenus.media) into the PRIVATE progress-photos bucket + progress_photos rows, keyed on a
// deterministic storage_path (so re-runs skip), and stamps migration_log.
//
// REALITY CHECK: lenus holds aggregates, not granular history. lenus.media has NO date column, so
// taken_on defaults to current_date and rows are labeled pose='legacy'. We do NOT fabricate a
// timeline. Weight / workout granular history did not come across; going-forward tracking starts fresh.
//
// Usage:
//   node .qa-visual/import-lenus-photos.cjs <profileId> <lenusClientId> [limit]
//   node .qa-visual/import-lenus-photos.cjs --self <legacyEmail> [limit]
//     --self resolves the profile + lenus id from a claimed contact by email (after claim).
//
// This mirrors src/lib/legacy/photo-import.ts exactly; the app path runs that module on claim.
const fs = require('fs');
const crypto = require('crypto');

const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
});

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const ref = (URL.match(/https:\/\/([a-z0-9]+)\.supabase/) || [])[1];
const BUCKET = 'progress-photos';

if (!SERVICE) {
  console.error('SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

// Run arbitrary SQL via the Management API (used for lenus reads + resolving --self).
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    throw new Error('SQL failed: ' + t.slice(0, 200));
  }
}

function objectKeyFor(profileId, r2Key) {
  const hash = crypto.createHash('sha256').update(r2Key).digest('hex').slice(0, 24);
  return `${profileId}/legacy/${hash}.jpg`;
}

// REST helpers against PostgREST with the service role key (bypasses RLS).
async function rest(method, path, body) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: r.ok, status: r.status, data };
}

async function uploadObject(path, bytes) {
  const r = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: Buffer.from(bytes),
  });
  return r.ok;
}

(async () => {
  const args = process.argv.slice(2);
  let profileId;
  let lenusId;
  let companyId;
  let limit = 25;

  if (args[0] === '--self') {
    const email = (args[1] || '').toLowerCase();
    if (!email) {
      console.error('usage: --self <email>');
      process.exit(1);
    }
    if (args[2]) limit = parseInt(args[2], 10);
    const rows = await sql(
      `select c.profile_id, c.lenus_id, c.company_id
       from public.contacts c
       where c.type='client' and c.is_legacy=true and lower(c.email)=lower('${email}')
       and c.profile_id is not null limit 1`,
    );
    if (!rows[0]) {
      console.error('No CLAIMED legacy contact found for', email, '(claim it first)');
      process.exit(1);
    }
    profileId = rows[0].profile_id;
    lenusId = rows[0].lenus_id;
    companyId = rows[0].company_id;
  } else {
    profileId = args[0];
    lenusId = args[1];
    if (args[2]) limit = parseInt(args[2], 10);
    if (!profileId || !lenusId) {
      console.error('usage: node .qa-visual/import-lenus-photos.cjs <profileId> <lenusClientId> [limit]');
      process.exit(1);
    }
    const co = await sql(`select company_id from public.profiles where id='${profileId}'`);
    companyId = co[0] && co[0].company_id;
  }

  console.log(`Importing up to ${limit} legacy photos for profile ${profileId} (lenus ${lenusId})`);

  const media = await sql(
    `select r2_url, r2_key from lenus.media
     where client_id='${lenusId}' and category='progress_photos'
     and r2_url like 'https://pub-%' limit ${limit}`,
  );
  console.log(`Found ${media.length} source photos`);

  let imported = 0;
  let skipped = 0;
  for (const row of media) {
    if (!row.r2_url || !row.r2_key) {
      skipped++;
      continue;
    }
    const path = objectKeyFor(profileId, row.r2_key);

    const existing = await rest('GET', `progress_photos?storage_path=eq.${encodeURIComponent(path)}&select=id`);
    if (existing.ok && Array.isArray(existing.data) && existing.data.length) {
      skipped++;
      continue;
    }

    let bytes;
    try {
      const res = await fetch(row.r2_url);
      if (!res.ok) {
        skipped++;
        continue;
      }
      bytes = await res.arrayBuffer();
    } catch {
      skipped++;
      continue;
    }

    const up = await uploadObject(path, bytes);
    if (!up) {
      skipped++;
      continue;
    }

    const ins = await rest('POST', 'progress_photos', {
      company_id: companyId,
      profile_id: profileId,
      storage_path: path,
      pose: 'legacy',
    });
    if (!ins.ok) {
      skipped++;
      continue;
    }
    imported++;
  }

  await rest('POST', 'migration_log', {
    company_id: companyId,
    lenus_id: lenusId,
    dataset: 'progress_photos_subscriber',
    records_imported: imported,
    status: 'imported',
  });

  console.log(`DONE: imported=${imported} skipped=${skipped} of ${media.length}`);
})().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
