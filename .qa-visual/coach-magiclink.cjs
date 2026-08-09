// Mint a one-time magic-link token for a test account so a browser can be signed in without a
// password being typed anywhere. Prints the localhost /auth/callback URL to open.
//
// Usage: node .qa-visual/coach-magiclink.cjs [email] [nextPath]
const fs = require('fs');

const env = {};
fs.readFileSync('.env.local', 'utf8')
  .split(/\r?\n/)
  .forEach((l) => {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) return;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  });

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2] || 'sample.casey@thickandfit.test';
const next = process.argv[3] || '/coach';

fetch(`${url}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email }),
})
  .then((r) => r.json())
  .then((j) => {
    if (!j.hashed_token) {
      console.error('no hashed_token in response:', JSON.stringify(j).slice(0, 400));
      process.exit(1);
    }
    console.log(
      `http://localhost:3000/auth/callback?token_hash=${j.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`,
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
