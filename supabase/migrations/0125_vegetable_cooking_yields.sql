-- Cooked vs uncooked, part 2: vegetables, and per-food yields the lookup can actually reach.
--
-- WHERE THIS STOOD. Seven category-level factors (beef, grain, legume, pork, poultry, protein,
-- seafood), covering 133 of 359 foods. The 226 uncovered split two ways: dairy, fat, snack,
-- condiment and beverage are CORRECTLY uncovered because nobody cooks them, and vegetables (49)
-- and prepared (22) are a real hole. Her own protocol names one of them outright: "Weigh oats,
-- eggwhites & green beans UNCOOKED. Weigh everything else COOKED."
--
-- WHY NOT ONE "vegetable" FACTOR. Because it would be a lie. Boiled broccoli holds ~90% of its
-- raw weight; boiled spinach holds ~36%. Averaging those into a single number would produce a
-- confident wrong answer for both, which is worse than the current honest silence, since the UI
-- only shows the toggle when a factor exists. Vegetables get PER-FOOD factors or nothing.
--
-- Factors are USDA Cooking Yields for Meat and Poultry / USDA Table of Cooking Yields for
-- Vegetables (Release 2), raw -> cooked weight retention. They are approximations of a real
-- distribution, not constants: cooking time, cut size and method all move them. That is acceptable
-- because the alternative on offer is the member guessing, and it is why the number is stored as
-- data with its source rather than hardcoded.

-- The per-food rows are keyed by name against THIS catalog, so the insert is a join rather than a
-- list of uuids that would rot the moment the catalog is reseeded.
insert into public.cooked_uncooked_ratios (food_id, category, state_from, state_to, factor, usda_source)
select distinct on (f.id) f.id, f.category, 'raw', 'cooked', v.factor, v.src
from (values
  -- Leafy greens collapse. This is the extreme end and the reason a category average cannot work.
  ('spinach',          0.36, 'USDA Cooking Yields R2 (spinach, boiled and drained, ~64% loss)'),
  ('kale',             0.55, 'USDA Cooking Yields R2 (kale, boiled and drained)'),
  ('mixed greens',     0.45, 'USDA Cooking Yields R2 (mixed leafy greens, cooked)'),
  -- Firm vegetables hold most of their weight.
  ('green beans',      0.90, 'USDA Cooking Yields R2 (green beans, boiled)'),
  ('broccoli',         0.90, 'USDA Cooking Yields R2 (broccoli, boiled)'),
  ('cauliflower',      0.90, 'USDA Cooking Yields R2 (cauliflower, boiled)'),
  ('carrot',           0.90, 'USDA Cooking Yields R2 (carrots, boiled)'),
  ('brussels sprouts', 0.90, 'USDA Cooking Yields R2 (brussels sprouts, boiled)'),
  ('asparagus',        0.90, 'USDA Cooking Yields R2 (asparagus, boiled)'),
  ('cabbage',          0.75, 'USDA Cooking Yields R2 (cabbage, boiled)'),
  ('eggplant',         0.85, 'USDA Cooking Yields R2 (eggplant, boiled)'),
  -- High-water vegetables usually met in a pan, where the loss is larger.
  ('zucchini',         0.80, 'USDA Cooking Yields R2 (summer squash, boiled)'),
  ('bell pepper',      0.75, 'USDA Cooking Yields R2 (peppers, sauteed)'),
  ('onion',            0.60, 'USDA Cooking Yields R2 (onions, sauteed)'),
  ('mushrooms',        0.55, 'USDA Cooking Yields R2 (mushrooms, sauteed)'),
  -- Starchy vegetables, boiled with skin.
  ('potato',           0.90, 'USDA Cooking Yields R2 (potato, boiled)'),
  ('sweet potato',     0.90, 'USDA Cooking Yields R2 (sweet potato, boiled)')
) as v(needle, factor, src)
join public.foods f on lower(f.name_en) like v.needle || '%'
where f.category = 'vegetable'
  -- Rows already named "cooked" state their macros in the cooked form, so a raw->cooked factor on
  -- them would be applied in the wrong direction. foodStateFromName reads the name; respect it.
  and lower(f.name_en) not like '%cooked%'
  and lower(f.name_en) not like '%baked%'
  and lower(f.name_en) not like '%boiled%'
  and not exists (
    select 1 from public.cooked_uncooked_ratios r where r.food_id = f.id
  )
order by f.id, v.factor;

comment on column public.cooked_uncooked_ratios.food_id is
  'Per-food yield, which OVERRIDES the category row. Vegetables need this: broccoli holds 90% of its raw weight and spinach 36%, so no single vegetable factor is honest. Readers must prefer a food_id match over a category match.';
