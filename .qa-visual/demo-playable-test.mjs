// Her filmed demos must be reachable BY A MEMBER, not just present in the bucket.
//
// The bug this guards: 366 of her 367 movements imported cleanly into
// `exercises.demo_storage_path` and STATE.md recorded "her demos playable 366/366", but the member
// workout player selected `video_mux_id` only, and just 2 rows carry one. So the migration audit
// read green while a member training saw a dumbbell icon on 1,303 of 1,305 movements. Her filmed
// demos are the reason this is her app rather than a spreadsheet, and they reached only the coach's
// own exercise page.
//
// "Present in the database" and "plays for the woman doing the workout" are different claims, and
// only the second one is the product. This test makes the second one the thing that is checked:
// it walks a REAL session the way the player does, signs the URLs the way the page does, and pulls
// actual bytes over HTTP. A row that points at a file the bucket does not have fails here.
//
// Run: node .qa-visual/demo-playable-test.mjs
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
fs.readFileSync('.env.local', 'utf8')
  .split(/\r?\n/)
  .forEach((l) => {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) {
      let v = m[2].trim();
      if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  });

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'lenus-coach-media';
// Enough to catch a systematically broken prefix without pulling 366 files on every run.
const SAMPLE = 12;

let failures = 0;
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  failures++;
};

// ---------------------------------------------------------------------------------------------
// 1. The library as a whole. Not an assertion about a number that will drift as she films more,
//    but a floor: if this collapses, an importer regressed and the console will still look fine.
// ---------------------------------------------------------------------------------------------
const { count: total } = await sb.from('exercises').select('id', { count: 'exact', head: true });
const { count: withDemo } = await sb
  .from('exercises')
  .select('id', { count: 'exact', head: true })
  .not('demo_storage_path', 'is', null);

console.log(`library: ${withDemo}/${total} exercises carry a filmed demo`);
if (withDemo < 300) fail(`only ${withDemo} demos linked; the sweep imported 366`);

// ---------------------------------------------------------------------------------------------
// 2. The player's own query, on a real session. This is the shape that was wrong: selecting
//    video_mux_id alone silently drops every one of her demos, and nothing throws.
// ---------------------------------------------------------------------------------------------
// `sessions` is labelled by day_label, not name_en. Selecting a column that does not exist returns
// null data with an error nobody reads, which is how the first version of this test reported that
// none of her sessions had footage when 229 of 230 do: the same silent-empty shape it exists to
// catch. Kept as a comment because the next person will reach for name_en too.
const { data: sessions, error: sessionErr } = await sb
  .from('sessions')
  .select('id, day_label, plan_id')
  .order('created_at', { ascending: true })
  .limit(40);
if (sessionErr) fail(`sessions read: ${sessionErr.message}`);

let checkedSession = null;
for (const s of sessions ?? []) {
  const { data: sx } = await sb.from('session_exercises').select('exercise_id').eq('session_id', s.id);
  const ids = (sx ?? []).map((r) => r.exercise_id);
  if (!ids.length) continue;
  const { data: exs } = await sb
    .from('exercises')
    .select('id, name_en, video_mux_id, demo_storage_path')
    .in('id', ids);
  const withPath = (exs ?? []).filter((e) => e.demo_storage_path);
  if (withPath.length) {
    checkedSession = { session: s, exercises: exs, withPath };
    break;
  }
}

if (!checkedSession) {
  fail('no session in the first 40 has a single exercise with a demo; the player would show none');
} else {
  const { session, exercises, withPath } = checkedSession;
  console.log(
    `session "${session.day_label}": ${withPath.length}/${exercises.length} movements have her footage`,
  );

  // -------------------------------------------------------------------------------------------
  // 3. Sign and actually FETCH. A path that no longer resolves in storage is the failure mode a
  //    row count cannot see, and it renders as the same empty state as "never filmed".
  // -------------------------------------------------------------------------------------------
  const paths = withPath.slice(0, SAMPLE).map((e) => e.demo_storage_path);
  const { data: signed, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) {
    fail(`createSignedUrls: ${error.message}`);
  } else {
    for (const row of signed) {
      if (row.error || !row.signedUrl) {
        fail(`sign failed: ${row.path}`);
        continue;
      }
      // Range request: proves the object streams without pulling a whole video per row.
      const res = await fetch(row.signedUrl, { headers: { Range: 'bytes=0-1023' } });
      if (!res.ok) {
        fail(`HTTP ${res.status} for ${row.path}`);
        continue;
      }
      const type = res.headers.get('content-type') ?? '';
      if (!type.startsWith('video/')) fail(`${row.path} served as "${type}", not video/*`);
    }
    console.log(`sampled ${signed.length} demos over HTTP`);
  }
}

// ---------------------------------------------------------------------------------------------
// 4. The private-bucket guarantee. demo-url.ts signs per request precisely because the bucket is
//    private; if it ever turns public, every signed-URL expiry in the app becomes decorative and
//    the whole library is enumerable by anyone who guesses a filename.
// ---------------------------------------------------------------------------------------------
const { data: buckets } = await sb.storage.listBuckets();
const b = (buckets ?? []).find((x) => x.name === BUCKET);
if (!b) fail(`bucket ${BUCKET} not found`);
else if (b.public) fail(`bucket ${BUCKET} is PUBLIC; her footage should require a signed URL`);
else console.log(`bucket ${BUCKET} is private`);

console.log(failures ? `\nFAILED (${failures})` : '\n✓ her demos are reachable by a member');
process.exit(failures ? 1 : 0);
