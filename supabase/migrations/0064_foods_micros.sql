-- 0064 -- Bounded micronutrient panel on foods (per 100g, matching the macro columns' contract).
-- The knowledge-graph prerequisite: "low in magnesium -> foods highest in magnesium" reasoning was
-- blocked on DATA, not infrastructure; USDA/OFF responses carry these values and we discarded them
-- at ingest. Chosen set = deficiency detection for the audience (women: iron, calcium, D, B12,
-- folate, magnesium, zinc, potassium) + lipid-quality coaching (cholesterol, trans, mono, poly).
-- Explicit columns, not jsonb: unit discipline stays visible (mg vs mcg) and "order by
-- magnesium_mg desc" stays a plain query. All nullable: sources often omit micros. New rows only;
-- NO backfill (cached rows stay macro-only and refresh naturally if ever re-fetched).
alter table public.foods
  add column if not exists calcium_mg        numeric,
  add column if not exists iron_mg           numeric,
  add column if not exists magnesium_mg      numeric,
  add column if not exists potassium_mg      numeric,
  add column if not exists zinc_mg           numeric,
  add column if not exists vitamin_c_mg      numeric,
  add column if not exists vitamin_d_mcg     numeric,
  add column if not exists vitamin_b12_mcg   numeric,
  add column if not exists vitamin_a_mcg_rae numeric,
  add column if not exists folate_mcg        numeric,
  add column if not exists cholesterol_mg    numeric,
  add column if not exists trans_fat_g       numeric,
  add column if not exists mono_fat_g        numeric,
  add column if not exists poly_fat_g        numeric;
