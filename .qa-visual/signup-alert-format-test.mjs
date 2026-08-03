// The signup alert is sent with parse_mode: 'HTML', so a member's own name is untrusted input that
// goes straight into markup. "Ben & Jerry <test>" unescaped makes Telegram reject the whole message
// with "can't parse entities", and the alert silently never arrives for that person only, which is
// the sort of bug that shows up as "it works for everyone except her".
//
// This asserts the escaping locally AND then asks Telegram itself to parse the real message, using a
// chat id that does not exist. The distinction in the reply is the whole test:
//   "chat not found"        -> the markup parsed fine, only the destination was wrong
//   "can't parse entities"  -> the markup is broken
// That lets the format be verified for real without a live chat to post into.
import fs from 'node:fs';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const TOKEN = env.TELEGRAM_BOT_TOKEN;

// Mirrors esc() in supabase/functions/ops-bot/telegram.ts.
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Mirrors sendSignupAlert() in supabase/functions/ops-bot/signup.ts.
function buildSignupMessage({ name, email, provider, role, todayCount, appUrl }) {
  const isStaff = role !== 'subscriber' && role !== 'free';
  const lines = [
    isStaff ? '👤 <b>NEW TEAM ACCOUNT</b>' : '🎉 <b>NEW SIGNUP</b>',
    '',
    `<b>${esc(name)}</b>`,
    esc(email),
    '',
    `<b>Signed up with:</b> ${esc(provider)}`,
    `<b>Role:</b> ${esc(role)}`,
  ];
  if (!isStaff) {
    lines.push('', todayCount > 1 ? `${todayCount} signups in the last 24h.` : 'First signup in the last 24h.', '', `${appUrl}/coach/clients`);
  } else {
    lines.push('', `${appUrl}/admin/team`);
  }
  return lines.join('\n');
}

const APP = 'https://www.teamthickandfit.com';
const CASES = [
  { label: 'ordinary member', name: 'Maria Garcia', email: 'maria@example.com', provider: 'google', role: 'subscriber', todayCount: 3 },
  { label: 'HOSTILE name (the real risk)', name: 'Ben & Jerry <script>alert(1)</script>', email: 'x@example.com', provider: 'email', role: 'subscriber', todayCount: 1 },
  { label: 'angle brackets in email', name: 'Ana', email: 'a<b>@example.com', provider: 'email', role: 'subscriber', todayCount: 1 },
  { label: 'no name yet', name: 'No name yet', email: 'noname@example.com', provider: 'email', role: 'subscriber', todayCount: 1 },
  { label: 'staff account', name: 'Coach Casey', email: 'casey@example.com', provider: 'google + email', role: 'coach', todayCount: 1 },
  { label: 'accents + emoji', name: 'Renée Ñuñez 💪', email: 'renee@example.com', provider: 'email', role: 'free', todayCount: 2 },
];

let pass = 0;
const fails = [];

// --- local escaping assertions ---------------------------------------------------------------
for (const c of CASES) {
  const msg = buildSignupMessage({ ...c, appUrl: APP });
  const bodyOnly = msg.replace(/<\/?b>/g, ''); // our own intentional tags
  if (/<script|<\/script|<img|<a /i.test(bodyOnly)) {
    fails.push(`${c.label}: raw HTML survived escaping`);
  } else {
    pass++;
  }
}

// --- ask Telegram to parse each one ------------------------------------------------------------
if (!TOKEN) {
  console.log('no TELEGRAM_BOT_TOKEN; local assertions only');
} else {
  for (const c of CASES) {
    const text = buildSignupMessage({ ...c, appUrl: APP });
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // A chat id that cannot exist. We want the PARSER to run, not the delivery to succeed.
      body: JSON.stringify({ chat_id: 1, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const j = await r.json();
    const desc = (j.description || '').toLowerCase();
    const parsedOk = !desc.includes('parse') && !desc.includes('entities') && !desc.includes('tag');
    console.log(`  ${parsedOk ? 'ok  ' : 'FAIL'} ${c.label.padEnd(30)} telegram said: ${j.description || 'delivered'}`);
    if (parsedOk) pass++;
    else fails.push(`${c.label}: ${j.description}`);
  }
}

console.log(`\nsignup alert format: ${pass} checks passed`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
console.log('PASS: every case is valid Telegram HTML.');
