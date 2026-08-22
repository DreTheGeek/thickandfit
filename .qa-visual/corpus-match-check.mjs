// Does the local corpus matcher still log chicken FEET for a plate of fried chicken?
//
// WHY A MIRROR AND NOT THE REAL FUNCTION. `matchFoodsBatch` lives in photo.ts, which is `server-only`
// and imports the request-scoped Supabase client, so it cannot run outside a Next request. The
// scoring rules it depends on are imported from the SHIPPED module (preparation.ts), so the part
// that actually decides the answer is the real one; only the two queries and the loop are restated
// here. If photo.ts's rounds are ever restructured, restate them here too - this file is a checker
// for the CORPUS and the ranking, not a substitute for reading that code.
//
//   node --env-file=.env.local .qa-visual/corpus-match-check.mjs
import { createClient } from '@supabase/supabase-js';
import { readPreparation, preparationAgreement, contradictsPreparation } from '../src/lib/nutrition/preparation.ts';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY:');
  console.error('  node --env-file=.env.local .qa-visual/corpus-match-check.mjs');
  process.exit(1);
}
const svc = createClient(URL, KEY, { auth: { persistSession: false } });
const COLS = 'id, name_en, kcal, protein_g, carb_g, fat_g, search_text';

// Mirrors photo.ts.
const STOP = new Set(['cooked', 'raw', 'dry', 'fresh', 'grilled', 'fried', 'roasted', 'baked', 'boiled', 'steamed', 'cocido', 'cocida', 'crudo', 'cruda', 'seco', 'seca', 'a', 'de', 'la', 'el', 'and', 'with', 'con', 'of']);
const keywords = (n) => n.toLowerCase().replace(/[^a-z0-9áéíóúñ\s]/gi, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const orSafe = (t) => t.replace(/[,%*()"\\]/g, ' ').replace(/\s+/g, ' ').trim();

function bestRowForTerm(rows, term, fullName) {
  const hits = rows.filter((r) => (r.search_text ?? '').includes(term));
  if (!hits.length) return null;
  const exact = hits.find((r) => (r.search_text ?? '').trim() === term);
  if (exact) return exact;
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const token = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`);
  const wordHits = hits.filter((r) => token.test(r.search_text ?? ''));
  const pool = wordHits.length ? wordHits : hits;
  const wanted = readPreparation(fullName);
  const contentWords = keywords(fullName);
  let best = null;
  let bestScore = -Infinity;
  for (const r of pool) {
    const text = r.search_text ?? '';
    const covered = contentWords.filter((w) => text.includes(w)).length;
    const coverage = contentWords.length ? covered / contentWords.length : 0;
    const score = coverage * 2 + preparationAgreement(wanted, readPreparation(text)) - text.length / 400;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return best;
}

function localMatchIsUsable(row, fullName) {
  const text = row.search_text ?? '';
  const words = keywords(fullName);
  if (words.length === 0) return true;
  if (words.filter((w) => text.includes(w)).length / words.length < 0.5) return false;
  const wanted = readPreparation(fullName);
  const got = readPreparation(text);
  if (contradictsPreparation(wanted, got)) return false;
  if ((wanted.fatClass === 'added-fat' || wanted.breaded) && got.fatClass !== 'added-fat' && !got.breaded) return false;
  return true;
}

async function match(names) {
  const phrases = names.map((n) => orSafe(n.trim().toLowerCase()));
  const results = names.map(() => null);
  const phraseTerms = [...new Set(phrases.filter((p) => p.length > 2))];
  if (phraseTerms.length) {
    const { data } = await svc.from('foods').select(COLS).or(phraseTerms.map((p) => `search_text.ilike.%${p}%`).join(',')).limit(80);
    const rows = data ?? [];
    for (let i = 0; i < names.length; i++) {
      const hit = bestRowForTerm(rows, phrases[i], names[i]);
      if (hit && localMatchIsUsable(hit, names[i])) results[i] = hit;
    }
  }
  const pending = names.map((n, i) => ({ i, words: keywords(n).map(orSafe).filter((w) => w.length > 2) })).filter((x) => results[x.i] === null && x.words.length);
  const kwTerms = [...new Set(pending.flatMap((x) => x.words))];
  if (kwTerms.length) {
    const { data } = await svc.from('foods').select(COLS).or(kwTerms.map((w) => `search_text.ilike.%${w}%`).join(',')).limit(150);
    const rows = data ?? [];
    for (const x of pending) {
      const rarity = new Map(x.words.map((w) => [w, rows.filter((r) => (r.search_text ?? '').includes(w)).length]));
      const ordered = [...x.words].sort((a, b) => (rarity.get(a) ?? 0) - (rarity.get(b) ?? 0) || b.length - a.length);
      for (const w of ordered) {
        const hit = bestRowForTerm(rows, w, names[x.i]);
        if (hit) {
          if (localMatchIsUsable(hit, names[x.i])) results[x.i] = hit;
          break;
        }
      }
    }
  }
  return results;
}

// The real item names gpt-5 returned for the KFC plate (ai_inferences 5433eb83, 2026-08-22), plus
// the shapes v5's PREPARATION and PLACE rules now produce for the same photo.
const CASES = [
  { name: 'fried chicken thigh, cooked, breaded', mustNotMatch: /feet|boiled|stewed/i },
  { name: 'fried chicken drumstick, cooked, breaded', mustNotMatch: /feet|boiled|stewed/i },
  { name: 'KFC fried chicken thigh, breaded, with skin', mustNotMatch: /feet|boiled|stewed/i },
  { name: 'buttermilk biscuit', mustNotMatch: /dry mix/i },
  // Regressions: the ordinary foods this matcher exists to serve must still resolve locally.
  { name: 'grilled chicken breast', mustNotMatch: /feet|fried/i },
  { name: 'cooked white rice', mustNotMatch: /nothing-here/i },
  { name: 'scrambled eggs', mustNotMatch: /eggplant/i },
];

const rows = await match(CASES.map((c) => c.name));
const fails = [];
console.log('');
for (let i = 0; i < CASES.length; i++) {
  const c = CASES[i];
  const r = rows[i];
  const to = r ? r.name_en : 'no local match (falls through to USDA grounding)';
  const bad = r && c.mustNotMatch.test(r.name_en);
  if (bad) fails.push(`"${c.name}" resolved to "${r.name_en}"`);
  console.log(`  ${bad ? 'FAIL' : 'ok  '}  "${c.name}"`);
  console.log(`          -> ${to}${r ? `  (${r.kcal} kcal, ${r.fat_g}g fat per 100g)` : ''}`);
}

if (fails.length) {
  console.error(`\nFAIL (${fails.length})`);
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('\ncorpus match: PASS, no fried food resolves to a boiled or stewed row');
