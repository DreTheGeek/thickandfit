-- Import Lenus recipes + meal plans into the Library. Idempotent. Macros computed from ingredients
-- (nutrients are per-100g, amount is grams -> scaled = per100g * amount/100; kcal = 4P+4C+9F).

-- 1) recipe books (distinct)
insert into public.recipe_books (company_id, name, slug)
select co.id, rb.name, trim(both '-' from regexp_replace(lower(rb.name), '[^a-z0-9]+', '-', 'g'))
from public.companies co,
  (select distinct recipe_book as name from lenus.recipes where recipe_book is not null and recipe_book <> '') rb
where co.slug = 'thick-and-fit'
on conflict (company_id, slug) do nothing;

-- 2) recipes (ignore junk nutrients column; macros rolled up later)
insert into public.recipes
  (company_id, lenus_id, recipe_book_id, recipe_book_name, category, name_en, image_url, has_video, procedure_en, prep_time_minutes, cooking_time_minutes, spices)
select co.id, r.id, rb.id, nullif(r.recipe_book, ''), nullif(r.category, ''), coalesce(nullif(r.name, ''), 'Recipe'),
  nullif(r.image_url, ''), coalesce(r.has_video, false), nullif(r.procedure, ''), r.prep_time, r.cooking_time, r.spices
from public.companies co
join lenus.recipes r on true
left join public.recipe_books rb
  on rb.company_id = co.id and rb.slug = trim(both '-' from regexp_replace(lower(r.recipe_book), '[^a-z0-9]+', '-', 'g'))
where co.slug = 'thick-and-fit'
on conflict (company_id, lenus_id) do nothing;

-- 3) recipe ingredients (scaled macros via lateral)
insert into public.recipe_ingredients
  (company_id, recipe_id, lenus_food_id, ingredient_name, amount_grams, unit_label, amount_print, protein_g, carb_g, fat_g, kcal, sequence)
select co.id, rec.id, ing->>'foodId', coalesce(nullif(ing->>'name', ''), 'Ingredient'),
  (ing->>'amount')::numeric, ing->>'unitLabel', ing->>'amountPrint',
  m.p, m.c, m.f, round(m.p * 4 + m.c * 4 + m.f * 9)::int, (ord - 1)::int
from public.companies co
join lenus.recipes r on true
join public.recipes rec on rec.company_id = co.id and rec.lenus_id = r.id
cross join lateral jsonb_array_elements(case when jsonb_typeof(r.ingredients) = 'array' then r.ingredients else '[]'::jsonb end)
  with ordinality as t(ing, ord)
cross join lateral (
  select
    round(coalesce((ing->'nutrients'->>'protein')::numeric, 0) * coalesce((ing->>'amount')::numeric, 0) / 100, 1) as p,
    round(coalesce((ing->'nutrients'->>'carbohydrate')::numeric, 0) * coalesce((ing->>'amount')::numeric, 0) / 100, 1) as c,
    round(coalesce((ing->'nutrients'->>'fat')::numeric, 0) * coalesce((ing->>'amount')::numeric, 0) / 100, 1) as f
) m
where co.slug = 'thick-and-fit'
  and not exists (select 1 from public.recipe_ingredients ri where ri.recipe_id = rec.id);

-- 4) roll ingredient macros up to the recipe
update public.recipes rec set
  protein_g = agg.p, carb_g = agg.c, fat_g = agg.f, kcal = agg.kcal, ingredient_count = agg.n
from (
  select recipe_id, round(sum(protein_g), 1) p, round(sum(carb_g), 1) c, round(sum(fat_g), 1) f, sum(kcal)::int kcal, count(*) n
  from public.recipe_ingredients group by recipe_id
) agg
where rec.id = agg.recipe_id;

-- 5) search_text for in-memory filtering
update public.recipes rec set search_text = lower(
  coalesce(rec.name_en, '') || ' ' || coalesce(rec.category, '') || ' ' || coalesce(rec.recipe_book_name, '') || ' ' ||
  coalesce((select string_agg(ingredient_name, ' ') from public.recipe_ingredients ri where ri.recipe_id = rec.id), '')
)
where rec.company_id = (select id from public.companies where slug = 'thick-and-fit');

-- 6) book recipe_count + cover image
update public.recipe_books rb set
  recipe_count = (select count(*) from public.recipes r where r.recipe_book_id = rb.id),
  cover_image_url = (select r.image_url from public.recipes r where r.recipe_book_id = rb.id and r.image_url is not null order by r.created_at limit 1)
where rb.company_id = (select id from public.companies where slug = 'thick-and-fit');

-- 7) meal plans (per-client, linked to contacts by lenus client id)
insert into public.meal_plans
  (company_id, lenus_id, contact_id, name, is_template, calorie_goal, split_protein_pct, split_carb_pct, split_fat_pct, macro_timing_name, num_meal_groups, plan_jsonb)
select co.id, mp.id, ct.id, coalesce(nullif(mp.name, ''), 'Meal plan'), false,
  mp.calorie_goal, mp.split_protein, mp.split_carb, mp.split_fat, nullif(mp.macro_timing_name, ''), mp.num_meal_groups, mp.plan
from public.companies co
join lenus.meal_plans mp on true
left join public.contacts ct on ct.company_id = co.id and ct.type = 'client' and ct.lenus_id = mp.client_id
where co.slug = 'thick-and-fit'
on conflict (company_id, lenus_id) do nothing;
