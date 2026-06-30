// Photo-to-macro eval harness (accuracy + structured-context audit).
// Runs test meal photos through the EXACT prompt + model the app uses (kept in sync with
// src/lib/nutrition/photo.ts) and reports the model's portion reasoning ("basis") + grams. When a
// manifest case provides ground-truth grams, it computes per-item absolute + percent error so the
// structured-context step can be measured over time.
//
// Usage:
//   node .qa-visual/photo-eval.cjs                       # runs the built-in seed case
//   node .qa-visual/photo-eval.cjs path/to/manifest.json # runs a custom manifest
// Manifest shape: [{ "label": string, "image": "<abs or cwd-relative path>", "expected"?: {"<food name>": grams} }]
//
// Loads OPENROUTER_API_KEY from .env.local at runtime (same approach as sql.cjs). Read-only: it never
// writes to the DB; it only calls the model.

const fs = require('fs');
const path = require('path');

// --- env (mirror sql.cjs) ---------------------------------------------------------------------
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
});
const apiKey = env.OPENROUTER_API_KEY;
if (!apiKey) { console.error('OPENROUTER_API_KEY missing from .env.local'); process.exit(1); }

// Must match src/lib/ai/models.ts AI_MODELS.photoMacro.
const VISION_MODEL = 'openai/gpt-5';

// Must match src/lib/nutrition/photo.ts VISION_PROMPT (the structured-context portion step).
const VISION_PROMPT = [
  'You are a precise bilingual (English/Spanish) nutrition vision model for a fitness coaching app.',
  'Accurate PORTION estimation is the hardest and most important part. Do NOT guess grams directly.',
  'Reason through these steps for the image before answering:',
  '1. SCALE: find a real-world size reference in the frame and state it. Typical sizes: dinner plate 26-28cm wide, salad/side plate ~20cm, dinner fork ~19cm long, soup spoon bowl ~4.5cm, soda can ~6.6cm wide x 12cm tall, smartphone ~14.7cm tall, a credit card 8.6cm. Pick the clearest one.',
  '2. For EACH distinct food: estimate the area it covers relative to that reference and its average height/thickness, to get an approximate volume in milliliters.',
  '3. Convert volume to edible weight in grams using the food\'s typical density (cooked rice/pasta ~0.8 g/mL, cooked meat/poultry/fish ~1.05 g/mL, dense stew/beans ~1.0 g/mL, leafy greens ~0.2 g/mL, bread ~0.3 g/mL, oils/butter ~0.92 g/mL, liquids ~1.0 g/mL).',
  'Critical rules:',
  '- Account for hidden cooking oil and butter: if a food looks pan-fried, sauteed, roasted, or glistening, add a separate "cooking oil" item with its estimated grams (a typical restaurant saute adds 7-15g of oil).',
  '- State whether each item is cooked or raw in its name when it matters (for example "cooked white rice", "grilled chicken breast", "raw spinach").',
  '- Use common, searchable food names, not brand names. Prefer the singular generic form (for example "chicken breast", not "Tyson chicken").',
  'Return ONLY minified JSON of this exact shape, no prose, no markdown fences:',
  '{"reference":string,"items":[{"name":string,"grams":number,"confidence":number,"basis":string}]}',
  'reference = the size reference and its assumed real size you used for scale.',
  'basis = a short note of your area/volume/density reasoning for that item (for example "covers ~half a 26cm plate, ~1.5cm deep, ~310mL rice @0.8 g/mL = ~250g").',
  'confidence is 0 to 1. If you cannot identify any food, return {"reference":"","items":[]}.',
].join('\n');

function dataUrl(imgPath) {
  const buf = fs.readFileSync(imgPath);
  const ext = path.extname(imgPath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function analyze(imgPath) {
  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: VISION_PROMPT },
        { role: 'user', content: [
          { type: 'text', text: 'Estimate the foods and their portions in grams for this meal photo. Use a size reference and show your area/volume/density basis for each item.' },
          { type: 'image_url', image_url: { url: dataUrl(imgPath) } },
        ] },
      ],
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) return { ok: false, ms, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim() || '';
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { return { ok: false, ms, error: `unparseable JSON: ${raw.slice(0, 300)}` }; }
  return { ok: true, ms, reference: parsed.reference || '', items: Array.isArray(parsed.items) ? parsed.items : [], usage: json.usage };
}

function gradeCase(items, expected) {
  if (!expected) return null;
  const rows = [];
  for (const [name, exp] of Object.entries(expected)) {
    const hit = items.find((it) => (it.name || '').toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes((it.name || '').toLowerCase()));
    if (!hit) { rows.push({ name, exp, got: null, absErr: null, pctErr: null }); continue; }
    const got = Number(hit.grams);
    rows.push({ name, exp, got, absErr: Math.abs(got - exp), pctErr: Math.round((Math.abs(got - exp) / exp) * 100) });
  }
  return rows;
}

const DEFAULT_MANIFEST_PATH = '.qa-visual/photo-eval-cases.json';

(async () => {
  const manifestArg = process.argv[2] || (fs.existsSync(DEFAULT_MANIFEST_PATH) ? DEFAULT_MANIFEST_PATH : null);
  if (!manifestArg) {
    console.log('No manifest. Pass one, or create .qa-visual/photo-eval-cases.json:');
    console.log('  [{ "label": "chicken+rice plate", "image": "abs/or/cwd-relative.jpg", "expected": {"grilled chicken breast": 170, "cooked white rice": 250} }]');
    console.log('Add real labeled meal photos (known grams per food) to grow the accuracy set.');
    process.exit(0);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestArg, 'utf8'));
  console.log(`photo-eval: model=${VISION_MODEL}  cases=${manifest.length}\n`);
  for (const c of manifest) {
    console.log(`### ${c.label}`);
    if (!fs.existsSync(c.image)) { console.log(`  SKIP: image not found: ${c.image}\n`); continue; }
    const r = await analyze(c.image);
    if (!r.ok) { console.log(`  FAILED (${r.ms}ms): ${r.error}\n`); continue; }
    console.log(`  ok in ${r.ms}ms · reference: ${r.reference || '(none)'}`);
    let total = 0;
    for (const it of r.items) {
      total += Number(it.grams) || 0;
      console.log(`   - ${it.name}  ${it.grams}g  (conf ${it.confidence})`);
      if (it.basis) console.log(`       basis: ${it.basis}`);
    }
    console.log(`  total: ${total}g across ${r.items.length} items`);
    if (r.usage) console.log(`  tokens: in=${r.usage.prompt_tokens} out=${r.usage.completion_tokens}`);
    const grade = gradeCase(r.items, c.expected);
    if (grade) {
      console.log('  GRADE vs ground truth:');
      for (const g of grade) console.log(`   - ${g.name}: expected ${g.exp}g, got ${g.got ?? 'MISS'}${g.got != null ? `g (err ${g.absErr}g / ${g.pctErr}%)` : ''}`);
      const scored = grade.filter((g) => g.pctErr != null);
      if (scored.length) console.log(`  mean abs portion error: ${Math.round(scored.reduce((a, g) => a + g.pctErr, 0) / scored.length)}%`);
    }
    console.log('');
  }
})();
