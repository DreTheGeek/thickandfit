// Seed Stephanie's meal-plan METHOD into her Coach Knowledge Base through the real ingest UI (so it
// chunks + embeds, given the OpenRouter key). This is what the AI auto-generator retrieves to ground
// plans in her actual method, and what she can later refine in Settings -> AI Knowledge. Idempotent:
// deletes any prior "Meal-plan method" source first.
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const PW = 'TFSample2026!';
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';
const TITLE = 'Meal-plan method';

const METHOD = `How I build meal plans (Thick & Fit method).

Philosophy: keep it SIMPLE. Every recipe should be three to five core ingredients. Simple is the whole point - if a plan is complicated, my clients won't stick to it. What matters is what you eat across the week, not any single meal.

Structure: a plan is five meal slots budgeted by calories - Breakfast, Snack 1, Lunch, Snack 2, and Dinner. Each slot gets a calorie target, and the targets add up to the client's daily calorie goal. For each slot I give one or two recipe OPTIONS so the client can pick what they feel like that day.

Macros first: I start from the client's daily calories and protein/carb/fat grams, then split those across the five slots and fill each slot with recipes that hit its budget. Protein stays high. I calculate at 4 calories per gram of protein and carbs and 9 per gram of fat.

Ingredients: always list raw-weight in grams (weigh before cooking). Use lean, specific products - 93/7 ground beef, never the fattier blends; protein pasta instead of regular; Greek yogurt (Fage), egg whites, chicken breast, tilapia, jasmine or brown rice. Name real products when it helps (Fage, Kodiak, Quest, :ratio). Put seasonings and sauces in a separate "spices" list, not the main ingredients.

Free veggies note: this is my favorite thing to add and Lenus never let me. On every plan I tell the client: if you're ever still hungry, feel free to add spinach, onions, cucumbers, or other low-calorie veggies - they're virtually free calories, they fill you up and barely move your macros. It keeps people from feeling deprived.

Recipes: each option gets realistic per-recipe macros, a prep and cook time, a few numbered steps, and sometimes a quick pro tip (like swapping sour cream for Greek yogurt - it tastes almost the same). Meal prep is encouraged: multiply a recipe and portion it into tupperware.

Personalizing per client: I set calories and macros from their goal (fat loss = a calorie deficit, healthier lifestyle = maintenance), their activity, and their body. If a client has PCOS or insulin issues I lean higher protein and fiber. I respect allergies and foods they dislike, and I swap ingredients for ones with a similar macro profile. The tone is warm and encouraging - these women trust me, so the plan should feel like it came from me.`;

async function delExisting() {
  const env = {};
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) { let v = m[2].trim(); if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; } });
  const SB = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  await fetch(`${SB}/rest/v1/coach_knowledge?company_id=eq.${COMPANY}&title=eq.${encodeURIComponent(TITLE)}`, {
    method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
}

(async () => {
  await delExisting();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.type('input[name=email]', 'sample.casey@thickandfit.test');
  await page.type('input[name=password]', PW);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 1200));

  await page.goto(`${BASE}/coach/settings/knowledge`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 800));

  const setNative = (selector, value, proto) =>
    page.evaluate((sel, val, p) => {
      const el = document.querySelector(sel);
      const setter = Object.getOwnPropertyDescriptor(window[p].prototype, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, selector, value, proto);

  await setNative('input[placeholder^="Title"]', TITLE, 'HTMLInputElement');
  await setNative('textarea', METHOD, 'HTMLTextAreaElement');

  const handle = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => /save knowledge/i.test(b.textContent)));
  await handle.asElement().click();

  // Wait for the ingest + embeddings to finish (poll DB).
  const env = {};
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) { let v = m[2].trim(); if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; } });
  const SB = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  let chunks = 0, embedded = 0;
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(`${SB}/rest/v1/coach_knowledge?company_id=eq.${COMPANY}&title=eq.${encodeURIComponent(TITLE)}&select=id,embedding`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    const rows = await r.json();
    chunks = rows.length;
    embedded = rows.filter((x) => x.embedding != null).length;
    if (chunks > 0) break;
  }
  console.log(`knowledge ingested: chunks=${chunks} embedded=${embedded}`);
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
