// Seed a curated starter food corpus (shared, company_id NULL) with accurate USDA-ish per-100g
// macros + Spanish names for the bilingual audience, plus cooked/uncooked ratios + key portions.
// Idempotent: clears source='seed' rows then re-inserts. Full USDA/OFF ETL comes later.
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
});
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const ref = (env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase/) || [])[1];

// [name_en, name_es, category, kcal, protein, carb, fat, fiber, density_g_per_ml]
const F = [
  // proteins
  ['Chicken breast, cooked', 'Pechuga de pollo, cocida', 'protein', 165, 31, 0, 3.6, 0, null],
  ['Chicken breast, raw', 'Pechuga de pollo, cruda', 'protein', 120, 22.5, 0, 2.6, 0, null],
  ['Chicken thigh, cooked', 'Muslo de pollo, cocido', 'protein', 209, 26, 0, 11, 0, null],
  ['Ground beef 90/10, cooked', 'Carne molida 90/10, cocida', 'protein', 217, 26, 0, 12, 0, null],
  ['Ground beef 85/15, raw', 'Carne molida 85/15, cruda', 'protein', 254, 17, 0, 20, 0, null],
  ['Steak sirloin, cooked', 'Bistec de sirloin, cocido', 'protein', 206, 29, 0, 9, 0, null],
  ['Pork loin, cooked', 'Lomo de cerdo, cocido', 'protein', 143, 21, 0, 6, 0, null],
  ['Ground turkey, cooked', 'Pavo molido, cocido', 'protein', 170, 22, 0, 9, 0, null],
  ['Turkey breast, cooked', 'Pechuga de pavo, cocida', 'protein', 135, 30, 0, 1, 0, null],
  ['Salmon, cooked', 'Salmon, cocido', 'protein', 208, 22, 0, 13, 0, null],
  ['Tilapia, cooked', 'Tilapia, cocida', 'protein', 128, 26, 0, 2.7, 0, null],
  ['Shrimp, cooked', 'Camarones, cocidos', 'protein', 99, 24, 0.2, 0.3, 0, null],
  ['Tuna, canned in water', 'Atun, en agua', 'protein', 116, 26, 0, 0.8, 0, null],
  ['Egg, whole', 'Huevo, entero', 'protein', 143, 12.6, 0.7, 9.5, 0, null],
  ['Egg whites', 'Claras de huevo', 'protein', 52, 11, 0.7, 0.2, 0, 1.03],
  ['Greek yogurt, nonfat', 'Yogur griego, sin grasa', 'dairy', 59, 10, 3.6, 0.4, 0, 1.03],
  ['Cottage cheese, low-fat', 'Requeson, bajo en grasa', 'dairy', 72, 12, 2.7, 1, 0, null],
  ['Whey protein powder', 'Proteina de suero', 'protein', 370, 80, 8, 6, 0, null],
  ['Tofu, firm', 'Tofu, firme', 'protein', 144, 15, 3, 9, 2, null],
  ['Black beans, cooked', 'Frijoles negros, cocidos', 'legume', 132, 8.9, 24, 0.5, 8.7, null],
  ['Pinto beans, cooked', 'Frijoles pintos, cocidos', 'legume', 143, 9, 26, 0.7, 9, null],
  ['Lentils, cooked', 'Lentejas, cocidas', 'legume', 116, 9, 20, 0.4, 7.9, null],
  ['Chickpeas, cooked', 'Garbanzos, cocidos', 'legume', 164, 8.9, 27, 2.6, 7.6, null],
  // grains / starches
  ['White rice, cooked', 'Arroz blanco, cocido', 'grain', 130, 2.7, 28, 0.3, 0.4, null],
  ['White rice, raw (dry)', 'Arroz blanco, crudo', 'grain', 365, 7, 80, 0.7, 1.3, null],
  ['Brown rice, cooked', 'Arroz integral, cocido', 'grain', 123, 2.7, 26, 1, 1.6, null],
  ['Oats, dry', 'Avena, seca', 'grain', 389, 17, 66, 7, 11, null],
  ['Quinoa, cooked', 'Quinoa, cocida', 'grain', 120, 4.4, 21, 1.9, 2.8, null],
  ['Pasta, cooked', 'Pasta, cocida', 'grain', 158, 5.8, 31, 0.9, 1.8, null],
  ['Sweet potato, cooked', 'Camote, cocido', 'vegetable', 90, 2, 21, 0.1, 3.3, null],
  ['Potato, cooked', 'Papa, cocida', 'vegetable', 87, 2, 20, 0.1, 1.8, null],
  ['Whole wheat bread', 'Pan integral', 'grain', 247, 13, 41, 3.4, 6, null],
  ['Flour tortilla', 'Tortilla de harina', 'grain', 304, 8, 49, 8, 3, null],
  ['Corn tortilla', 'Tortilla de maiz', 'grain', 218, 5.7, 45, 2.8, 6, null],
  ['Plantain', 'Platano macho', 'fruit', 122, 1.3, 32, 0.4, 2.3, null],
  // vegetables
  ['Broccoli', 'Brocoli', 'vegetable', 34, 2.8, 7, 0.4, 2.6, null],
  ['Spinach', 'Espinaca', 'vegetable', 23, 2.9, 3.6, 0.4, 2.2, null],
  ['Mixed greens', 'Mezcla de hojas verdes', 'vegetable', 17, 1.4, 3, 0.2, 1.5, null],
  ['Bell pepper', 'Pimiento', 'vegetable', 31, 1, 6, 0.3, 2.1, null],
  ['Carrot', 'Zanahoria', 'vegetable', 41, 0.9, 10, 0.2, 2.8, null],
  ['Tomato', 'Tomate', 'vegetable', 18, 0.9, 3.9, 0.2, 1.2, null],
  ['Onion', 'Cebolla', 'vegetable', 40, 1.1, 9, 0.1, 1.7, null],
  ['Cucumber', 'Pepino', 'vegetable', 15, 0.7, 3.6, 0.1, 0.5, null],
  ['Zucchini', 'Calabacin', 'vegetable', 17, 1.2, 3.1, 0.3, 1, null],
  ['Avocado', 'Aguacate', 'fruit', 160, 2, 9, 15, 7, null],
  // fruits
  ['Banana', 'Platano', 'fruit', 89, 1.1, 23, 0.3, 2.6, null],
  ['Apple', 'Manzana', 'fruit', 52, 0.3, 14, 0.2, 2.4, null],
  ['Strawberries', 'Fresas', 'fruit', 32, 0.7, 7.7, 0.3, 2, null],
  ['Blueberries', 'Arandanos', 'fruit', 57, 0.7, 14, 0.3, 2.4, null],
  ['Orange', 'Naranja', 'fruit', 47, 0.9, 12, 0.1, 2.4, null],
  ['Grapes', 'Uvas', 'fruit', 69, 0.7, 18, 0.2, 0.9, null],
  ['Pineapple', 'Pina', 'fruit', 50, 0.5, 13, 0.1, 1.4, null],
  ['Mango', 'Mango', 'fruit', 60, 0.8, 15, 0.4, 1.6, null],
  // dairy / fats / nuts
  ['Milk, 2%', 'Leche, 2%', 'dairy', 50, 3.4, 4.8, 2, 0, 1.03],
  ['Almond milk, unsweetened', 'Leche de almendras, sin azucar', 'dairy', 15, 0.6, 0.3, 1.2, 0.3, 1.03],
  ['Cheddar cheese', 'Queso cheddar', 'dairy', 403, 25, 1.3, 33, 0, null],
  ['Queso fresco', 'Queso fresco', 'dairy', 299, 18, 3.6, 24, 0, null],
  ['Mozzarella, part-skim', 'Mozzarella, semidescremada', 'dairy', 254, 24, 2.8, 16, 0, null],
  ['Butter', 'Mantequilla', 'fat', 717, 0.9, 0.1, 81, 0, null],
  ['Olive oil', 'Aceite de oliva', 'fat', 884, 0, 0, 100, 0, 0.92],
  ['Avocado oil', 'Aceite de aguacate', 'fat', 884, 0, 0, 100, 0, 0.92],
  ['Peanut butter', 'Mantequilla de mani', 'fat', 588, 25, 20, 50, 6, null],
  ['Almonds', 'Almendras', 'fat', 579, 21, 22, 50, 12.5, null],
  ['Walnuts', 'Nueces', 'fat', 654, 15, 14, 65, 6.7, null],
];

const RATIOS = [
  // category-level raw->cooked weight factors (USDA Cooking Yields R2)
  ['poultry', 0.75, 'USDA Cooking Yields R2 (poultry ~25% loss)'],
  ['protein', 0.75, 'USDA Cooking Yields R2 (meat ~25% loss)'],
  ['grain', 3.0, 'USDA Cooking Yields R2 (rice/grains absorb ~3x dry weight)'],
];

const PORTIONS = [
  // [food name_en match, label_en, label_es, grams, is_cooked, is_default]
  ['Chicken breast, cooked', '1 breast', '1 pechuga', 174, true, true],
  ['White rice, cooked', '1 cup', '1 taza', 158, true, true],
  ['Egg, whole', '1 large egg', '1 huevo grande', 50, false, true],
  ['Banana', '1 medium', '1 mediano', 118, false, true],
  ['Avocado', '1/2 avocado', '1/2 aguacate', 100, false, true],
  ['Olive oil', '1 tbsp', '1 cucharada', 14, false, true],
  ['Peanut butter', '1 tbsp', '1 cucharada', 16, false, true],
  ['Greek yogurt, nonfat', '1 cup', '1 taza', 245, false, true],
];

function esc(s) { return s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`; }
function num(n) { return n == null ? 'null' : String(n); }

const foodVals = F.map((r) => {
  const [en, es, cat, kcal, p, c, f, fib, dens] = r;
  const search = `${en} ${es || ''}`.toLowerCase();
  return `(null,'seed',${esc(en)},${esc(es)},${esc(cat)},${num(kcal)},${num(p)},${num(c)},${num(f)},${num(fib)},${dens == null ? 'null' : num(dens)},true,${esc(search)})`;
}).join(',\n');

const sql = `
delete from public.food_log where food_id in (select id from public.foods where source='seed');
delete from public.foods where source='seed';
insert into public.foods (company_id, source, name_en, name_es, category, kcal, protein_g, carb_g, fat_g, fiber_g, density_g_per_ml, is_verified, search_text) values
${foodVals};
insert into public.cooked_uncooked_ratios (category, state_from, state_to, factor, usda_source) values
${RATIOS.map((r) => `(${esc(r[0])},'raw','cooked',${num(r[1])},${esc(r[2])})`).join(',\n')};
insert into public.food_portions (food_id, label_en, label_es, grams, is_cooked, is_default)
select f.id, p.label_en, p.label_es, p.grams, p.is_cooked, p.is_default from (values
${PORTIONS.map((p) => `(${esc(p[0])},${esc(p[1])},${esc(p[2])},${num(p[3])},${p[4]},${p[5]})`).join(',\n')}
) as p(fname, label_en, label_es, grams, is_cooked, is_default)
join public.foods f on f.name_en = p.fname and f.source='seed';
`;

fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})
  .then((r) => r.text())
  .then((t) => console.log(t || 'OK'))
  .catch((e) => { console.error('FATAL', e.message); process.exit(1); });
