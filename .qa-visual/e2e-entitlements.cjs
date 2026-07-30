// Entitlement-table regression suite (migration 0095).
//
// Asserts the properties the App Store checklist calls out as blockers:
//   1. IDEMPOTENCY: redelivering the same provider event never double-grants. Duplicate webhook
//      delivery is normal, so this is structural (unique index), not procedural.
//   2. Multi-source: apple / stripe / ghl / manual can all grant the same product independently.
//   3. Expiry is enforced at read time (an elapsed expires_at does not grant).
//   4. Status vocabulary is enforced by the DB, and past_due does NOT grant access.
//   5. Revoke leaves an audit trail rather than deleting the row.
//
// Run: node .qa-visual/e2e-entitlements.cjs
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(process.cwd(), 'node_modules/@supabase/supabase-js'));

const env = {};
fs.readFileSync('.env.local', 'utf8')
  .split(/\r?\n/)
  .forEach((l) => {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  });

async function serviceKey() {
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY;
  const ref = (env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase/) || [])[1];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
  });
  const k = (await res.json()).find((x) => x.name === 'service_role');
  return k.api_key;
}

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

const TEST_EMAIL = 'sample.onboard@thickandfit.test';

(async () => {
  const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, await serviceKey(), {
    auth: { persistSession: false },
  });

  const { data: prof } = await svc
    .from('profiles')
    .select('id, company_id')
    .eq('email', TEST_EMAIL)
    .maybeSingle();
  if (!prof) throw new Error('test member missing; run node .qa-visual/seed-onboard-test.cjs');
  const { id: profileId, company_id: companyId } = prof;

  // Clean slate for this profile only.
  await svc.from('entitlements').delete().eq('profile_id', profileId);

  const upsert = (row) =>
    svc.from('entitlements').upsert(
      { company_id: companyId, profile_id: profileId, product_key: 'self_guided', ...row },
      { onConflict: 'company_id,source,external_txn_id' },
    );

  // 1. Idempotency: same (source, external_txn_id) three times = ONE row.
  for (let i = 0; i < 3; i++) {
    const { error } = await upsert({
      source: 'stripe',
      status: 'active',
      external_txn_id: 'sub_idempotency_test',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      raw_payload: { attempt: i },
    });
    if (error) throw new Error('upsert ' + i + ': ' + error.message);
  }
  let { count } = await svc
    .from('entitlements')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('external_txn_id', 'sub_idempotency_test');
  check('IDEMPOTENCY: 3 redeliveries of one event -> 1 row', count === 1, `rows=${count}`);

  // 2. Multi-source: a different provider grants independently, same profile.
  await upsert({
    source: 'apple',
    status: 'active',
    external_txn_id: 'apple_original_txn_123',
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  });
  ({ count } = await svc
    .from('entitlements')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId));
  check('MULTI-SOURCE: apple grant coexists with stripe', count === 2, `rows=${count}`);

  // 3. The DB rejects a source outside the checklist vocabulary.
  const { error: badSource } = await upsert({
    source: 'paypal',
    status: 'active',
    external_txn_id: 'nope',
  });
  check('CONSTRAINT: unknown source rejected', Boolean(badSource), badSource ? 'rejected' : 'ACCEPTED (bad)');

  // 4. The DB rejects an unmodeled status.
  const { error: badStatus } = await upsert({
    source: 'ghl',
    status: 'vibes',
    external_txn_id: 'ghl_1',
  });
  check('CONSTRAINT: unknown status rejected', Boolean(badStatus), badStatus ? 'rejected' : 'ACCEPTED (bad)');

  // 5. Read-time expiry + status filtering, mirroring isEntitled() exactly.
  await svc.from('entitlements').delete().eq('profile_id', profileId);
  await upsert({
    source: 'stripe',
    status: 'active',
    external_txn_id: 'sub_expired',
    expires_at: new Date(Date.now() - 3600_000).toISOString(), // an hour ago
  });
  const entitledNow = async () => {
    const { data } = await svc
      .from('entitlements')
      .select('status, expires_at')
      .eq('profile_id', profileId)
      .in('status', ['active', 'trialing']);
    const now = Date.now();
    return (data ?? []).some((r) => !r.expires_at || new Date(r.expires_at).getTime() > now);
  };
  check('EXPIRY: elapsed expires_at does NOT grant', (await entitledNow()) === false);

  await svc.from('entitlements').delete().eq('profile_id', profileId);
  await upsert({ source: 'manual', status: 'active', external_txn_id: 'comp:x', expires_at: null });
  check('OPEN-ENDED: null expires_at grants', (await entitledNow()) === true);

  await svc.from('entitlements').delete().eq('profile_id', profileId);
  await upsert({
    source: 'stripe',
    status: 'past_due',
    external_txn_id: 'sub_pastdue',
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  });
  check('PAST_DUE does NOT grant paid access', (await entitledNow()) === false);

  // 6. Revoke preserves the audit trail.
  await svc.from('entitlements').delete().eq('profile_id', profileId);
  await upsert({ source: 'manual', status: 'active', external_txn_id: 'comp:y' });
  await svc
    .from('entitlements')
    .update({ status: 'revoked' })
    .eq('profile_id', profileId)
    .eq('source', 'manual');
  const { data: revoked } = await svc
    .from('entitlements')
    .select('status')
    .eq('profile_id', profileId)
    .eq('external_txn_id', 'comp:y')
    .maybeSingle();
  check('REVOKE keeps the row for audit', revoked?.status === 'revoked', String(revoked?.status));
  check('REVOKE removes access', (await entitledNow()) === false);

  // Cleanup.
  await svc.from('entitlements').delete().eq('profile_id', profileId);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e.message || e);
  process.exit(1);
});
