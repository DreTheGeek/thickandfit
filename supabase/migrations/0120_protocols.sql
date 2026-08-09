-- 0120 Protocols: the fixed 2-week onboarding template, step one of Stephanie's two-step onboarding.
--
-- WHY THIS IS NOT A MEAL PLAN. `meal_plans` models a per-client calorie goal, a macro split and
-- slot-level recipe VARIATION. A protocol is the exact opposite shape: a fixed ordered rule list plus
-- ONE fixed day repeated for `duration_days`, identical for every client, with "Consistency > variety"
-- stated as the point rather than a limitation. Her own header reads "EVERYONE must follow". Forcing
-- it into meal_plans would have meant either 265 identical rows or a template row whose per-client
-- macro columns are lies. See .planning/PROTOCOL-ANTI-INFLAMMATORY-RESET.md.
--
-- HER NUMBERS ARE STORED TWICE, ON PURPOSE. `protocols.stated_*` is what SHE wrote on the PDF
-- ("<1600 / 135 / 151 / 40"). The five `protocol_meals` rows sum to 1555 / 134 / 151 / 39. Both are
-- correct: hers is a deliberate round-up. Nothing in this schema or in any reader may overwrite her
-- stated figure with the sum. The sum is DERIVED at read time and shown next to hers, never instead
-- of hers.
--
-- STATED KCAL IS TEXT. She wrote "<1600", and the "<" is an instruction to the client, not a rounding
-- artefact. An int column would silently delete it. The three macro figures are ints because she wrote
-- them as plain numbers.
--
-- BILINGUAL FROM THE START. Every member-visible string has an _en and an _es column. Half her
-- audience is Spanish-first and this protocol is day one of their experience, so a Spanish column
-- added later would mean the first cohort never gets one. `protocols.es_status` gates it: the seeded
-- Spanish is a faithful DRAFT translation and is marked as such, because the copy is Stephanie's IP
-- and only she approves her own voice. A member-facing reader must serve Spanish only at 'approved'.
--
-- ID SPACE: assignments target `contacts` (270 client rows today), matching meal_plans.contact_id,
-- because the CRM contact is the coach's unit of "a client". `profile_id` is resolved from
-- contacts.profile_id at assign time and stored alongside so the member-facing surface, when it ships,
-- has a direct handle without a second join. Only 5 of 270 contacts have a profile pre-launch, which
-- is exactly why contact_id is the NOT NULL side.
--
-- RLS: coach roles of the same company, matching recipes / meal_plans / coach_settings. Members never
-- read these tables directly; every member-facing reader in this codebase goes through the service
-- client. No money columns anywhere (macros are grams and kcal).

-- ---------------------------------------------------------------------------------------------
-- protocols: the template header
-- ---------------------------------------------------------------------------------------------
create table if not exists public.protocols (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies(id) on delete cascade,
  slug                    text not null,
  name_en                 text not null,
  name_es                 text,
  purpose_en              text not null,
  purpose_es              text,
  duration_days           smallint not null default 14,
  -- Her stated daily target, verbatim. See the header note on why kcal is text.
  stated_kcal_text        text not null,
  stated_protein_g        smallint not null,
  stated_carb_g           smallint not null,
  stated_fat_g            smallint not null,
  -- The fasted drink is NOT one of the meals; it is a block of its own, before meal 1.
  fasted_drink_title_en   text,
  fasted_drink_title_es   text,
  fasted_drink_note_en    text,
  fasted_drink_note_es    text,
  es_status               text not null default 'missing',
  is_published            boolean not null default false,
  sort_order              smallint not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (company_id, slug),
  constraint protocols_duration_range check (duration_days between 1 and 365),
  constraint protocols_es_status_valid check (es_status in ('missing', 'draft', 'approved')),
  constraint protocols_stated_ranges check (
    stated_protein_g between 0 and 600
    and stated_carb_g between 0 and 900
    and stated_fat_g between 0 and 400
  )
);
alter table public.protocols enable row level security;
create index if not exists idx_protocols_company on public.protocols(company_id, sort_order);
drop policy if exists protocols_tenant on public.protocols;
create policy protocols_tenant on public.protocols
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
drop trigger if exists set_protocols_updated_at on public.protocols;
create trigger set_protocols_updated_at before update on public.protocols
  for each row execute function public.set_updated_at();

comment on table public.protocols is
  'A fixed onboarding protocol: an ordered rule list plus one fixed day repeated for duration_days, identical for every client. Deliberately NOT meal_plans, which models per-client targets and slot variation.';
comment on column public.protocols.stated_kcal_text is
  'The coach''s OWN stated daily kcal, verbatim (e.g. "<1600"). Never derived, never overwritten with the sum of the meals. Readers show this next to the summed figure, not instead of it.';
comment on column public.protocols.es_status is
  'missing = no Spanish yet. draft = translated but NOT approved by the coach; member-facing readers must not serve it. approved = she signed off.';

-- ---------------------------------------------------------------------------------------------
-- protocol_rules: the non-negotiables, in her order. Order is meaning here: the weighing convention
-- is rules 1 to 4 because it is the most error-prone thing in any plan.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.protocol_rules (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  sequence    smallint not null,
  text_en     text not null,
  text_es     text,
  unique (protocol_id, sequence)
);
alter table public.protocol_rules enable row level security;
create index if not exists idx_protocol_rules_protocol on public.protocol_rules(protocol_id, sequence);
create index if not exists idx_protocol_rules_company on public.protocol_rules(company_id);
drop policy if exists protocol_rules_tenant on public.protocol_rules;
create policy protocol_rules_tenant on public.protocol_rules
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- ---------------------------------------------------------------------------------------------
-- protocol_drink_items: the fasted morning digestive drink
-- ---------------------------------------------------------------------------------------------
create table if not exists public.protocol_drink_items (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  sequence    smallint not null,
  item_en     text not null,
  item_es     text,
  -- Free text, not a number: "1 scoop" and "30 g" live in the same column by design.
  amount_en   text not null,
  amount_es   text,
  unique (protocol_id, sequence)
);
alter table public.protocol_drink_items enable row level security;
create index if not exists idx_protocol_drink_protocol on public.protocol_drink_items(protocol_id, sequence);
create index if not exists idx_protocol_drink_company on public.protocol_drink_items(company_id);
drop policy if exists protocol_drink_items_tenant on public.protocol_drink_items;
create policy protocol_drink_items_tenant on public.protocol_drink_items
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- ---------------------------------------------------------------------------------------------
-- protocol_meals: the one day. Macros sit at MEAL level because that is the only level she gave
-- them at; inventing per-item macros would be fabricating her numbers.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.protocol_meals (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  sequence    smallint not null,
  name_en     text not null,
  name_es     text,
  kcal        smallint not null,
  protein_g   smallint not null,
  carb_g      smallint not null,
  fat_g       smallint not null,
  unique (protocol_id, sequence),
  constraint protocol_meals_macro_ranges check (
    kcal between 0 and 5000
    and protein_g between 0 and 600
    and carb_g between 0 and 900
    and fat_g between 0 and 400
  )
);
alter table public.protocol_meals enable row level security;
create index if not exists idx_protocol_meals_protocol on public.protocol_meals(protocol_id, sequence);
create index if not exists idx_protocol_meals_company on public.protocol_meals(company_id);
drop policy if exists protocol_meals_tenant on public.protocol_meals;
create policy protocol_meals_tenant on public.protocol_meals
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

create table if not exists public.protocol_meal_items (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  meal_id     uuid not null references public.protocol_meals(id) on delete cascade,
  sequence    smallint not null,
  text_en     text not null,
  text_es     text,
  unique (meal_id, sequence)
);
alter table public.protocol_meal_items enable row level security;
create index if not exists idx_protocol_meal_items_meal on public.protocol_meal_items(meal_id, sequence);
create index if not exists idx_protocol_meal_items_company on public.protocol_meal_items(company_id);
drop policy if exists protocol_meal_items_tenant on public.protocol_meal_items;
create policy protocol_meal_items_tenant on public.protocol_meal_items
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- ---------------------------------------------------------------------------------------------
-- protocol_grocery_items: the whole-duration shop. Quantities are text because the source mixes
-- units and parentheticals ("42 large (3 and a half dozen)", "~3 quarts", "1.4 kg (~3.1 lbs)").
-- Category is carried as bilingual text rather than an enum so she can add a category without a
-- migration; readers group CONSECUTIVE rows by category, ordered by `sequence`.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.protocol_grocery_items (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  sequence    smallint not null,
  category_en text not null,
  category_es text,
  item_en     text not null,
  item_es     text,
  quantity_en text,
  quantity_es text,
  unique (protocol_id, sequence)
);
alter table public.protocol_grocery_items enable row level security;
create index if not exists idx_protocol_grocery_protocol on public.protocol_grocery_items(protocol_id, sequence);
create index if not exists idx_protocol_grocery_company on public.protocol_grocery_items(company_id);
drop policy if exists protocol_grocery_items_tenant on public.protocol_grocery_items;
create policy protocol_grocery_items_tenant on public.protocol_grocery_items
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- ---------------------------------------------------------------------------------------------
-- protocol_assignments: who got it, when it was sent, WHEN IT ENDS, and whether the personalised
-- plan that step two owes them has landed.
--
-- `ends_on` is stored, not computed on read, because it is the promise made to the client on the day
-- she sent it. Editing the template's duration_days later must not silently move a live client's end
-- date. It cannot be a generated column either: the duration lives on another table.
--
-- `plan_delivered_on` is the whole point of the table. "The 14 days ended and nobody built her plan"
-- is the failure this replaces, so the due state is queryable: ends_on <= today and
-- plan_delivered_on is null.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.protocol_assignments (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  protocol_id       uuid not null references public.protocols(id) on delete restrict,
  contact_id        uuid not null references public.contacts(id) on delete cascade,
  profile_id        uuid references public.profiles(id) on delete set null,
  locale            text not null default 'en',
  sent_on           date not null,
  ends_on           date not null,
  status            text not null default 'active',
  completed_on      date,
  plan_delivered_on date,
  notes             text,
  assigned_by       uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint protocol_assignments_locale_valid check (locale in ('en', 'es')),
  constraint protocol_assignments_status_valid check (status in ('active', 'completed', 'cancelled')),
  constraint protocol_assignments_window check (ends_on >= sent_on),
  -- completed_on and status cannot disagree. Without this, "completed" with a null date is a row no
  -- report can order, and a completion date on an active row is a half-finished write nobody notices.
  constraint protocol_assignments_completed_shape check (
    (status = 'completed' and completed_on is not null)
    or (status <> 'completed' and completed_on is null)
  )
);
alter table public.protocol_assignments enable row level security;
create index if not exists idx_protocol_assignments_company on public.protocol_assignments(company_id, status);
create index if not exists idx_protocol_assignments_contact on public.protocol_assignments(contact_id);
create index if not exists idx_protocol_assignments_protocol on public.protocol_assignments(protocol_id);
-- The "plan is due" query: active window closed, nothing delivered.
create index if not exists idx_protocol_assignments_due
  on public.protocol_assignments(company_id, ends_on)
  where plan_delivered_on is null;
-- One live run per client per protocol. Partial, so a client who finished the reset can be put
-- through it again later without tripping the constraint.
create unique index if not exists uidx_protocol_assignments_active
  on public.protocol_assignments(company_id, contact_id, protocol_id)
  where status = 'active';
drop policy if exists protocol_assignments_tenant on public.protocol_assignments;
create policy protocol_assignments_tenant on public.protocol_assignments
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
drop trigger if exists set_protocol_assignments_updated_at on public.protocol_assignments;
create trigger set_protocol_assignments_updated_at before update on public.protocol_assignments
  for each row execute function public.set_updated_at();

comment on column public.protocol_assignments.ends_on is
  'The LAST day the client is on the protocol, INCLUSIVE of sent_on: ends_on = sent_on + duration_days - 1, so a 14-day reset sent on the 9th runs the 9th to the 22nd and the personalised plan is due on the 23rd. Stored, never recomputed: changing the template duration must not move a live client''s date.';
comment on column public.protocol_assignments.plan_delivered_on is
  'Step two landed. Null past ends_on = the personalised meal plan is overdue. This column is why the table exists.';

-- ---------------------------------------------------------------------------------------------
-- SEED: The 2-week Whole Foods Anti-Inflammatory Reset.
--
-- Transcribed verbatim from the PDF Daniella sent Shayna on 5 Aug 2026. Her capitalisation carries
-- her emphasis (UNCOOKED, COOKED, NO PROTEIN SHAKES OR BARS OR CHIPS, INNER FILLET, FRESH) so it is
-- preserved exactly and no markup is stored. Her wording, her spelling ("eggwhites"), her numbers.
-- The Spanish is a faithful draft, flagged es_status = 'draft' until she approves it.
--
-- Re-runnable: the header upserts on (company_id, slug) and every child list is rebuilt from scratch,
-- so applying this twice leaves exactly one copy.
-- ---------------------------------------------------------------------------------------------
do $seed$
declare
  v_company  uuid;
  v_protocol uuid;
begin
  select id into v_company from public.companies where slug = 'thick-and-fit';
  if v_company is null then
    raise notice 'protocols seed skipped: no thick-and-fit company in this database';
    return;
  end if;

  insert into public.protocols (
    company_id, slug, name_en, name_es, purpose_en, purpose_es, duration_days,
    stated_kcal_text, stated_protein_g, stated_carb_g, stated_fat_g,
    fasted_drink_title_en, fasted_drink_title_es, fasted_drink_note_en, fasted_drink_note_es,
    es_status, is_published, sort_order
  ) values (
    v_company,
    'anti-inflammatory-reset',
    'The 2-week Whole Foods Anti-Inflammatory Reset',
    'El Reset Antiinflamatorio de 2 Semanas con Comida Real',
    'This reset is designed to support fat loss, reduce inflammation, curb sugar cravings and build discipline through whole foods and consistency.',
    'Este reset está diseñado para apoyar la pérdida de grasa, reducir la inflamación, cortar los antojos de azúcar y construir disciplina a través de comida real y consistencia.',
    14,
    '<1600', 135, 151, 40,
    'Fasted morning digestive drink',
    'Bebida digestiva en ayunas por la mañana',
    'Taken on an empty stomach before meal 1. Mandatory, and it does not count as one of the 5 meals.',
    'Se toma con el estómago vacío antes de la comida 1. Es obligatoria y no cuenta como una de las 5 comidas.',
    'draft', true, 0
  )
  on conflict (company_id, slug) do update set
    name_en               = excluded.name_en,
    name_es               = excluded.name_es,
    purpose_en            = excluded.purpose_en,
    purpose_es            = excluded.purpose_es,
    duration_days         = excluded.duration_days,
    stated_kcal_text      = excluded.stated_kcal_text,
    stated_protein_g      = excluded.stated_protein_g,
    stated_carb_g         = excluded.stated_carb_g,
    stated_fat_g          = excluded.stated_fat_g,
    fasted_drink_title_en = excluded.fasted_drink_title_en,
    fasted_drink_title_es = excluded.fasted_drink_title_es,
    fasted_drink_note_en  = excluded.fasted_drink_note_en,
    fasted_drink_note_es  = excluded.fasted_drink_note_es
  returning id into v_protocol;

  delete from public.protocol_rules where protocol_id = v_protocol;
  insert into public.protocol_rules (company_id, protocol_id, sequence, text_en, text_es)
  values
    (v_company, v_protocol, 1,
     'Weigh oats, eggwhites and green beans UNCOOKED.',
     'Pesa la avena, las claras de huevo y los ejotes CRUDOS.'),
    (v_company, v_protocol, 2,
     'Weigh everything else COOKED.',
     'Pesa todo lo demás COCIDO.'),
    (v_company, v_protocol, 3,
     'Proteins are listed in ounces cooked.',
     'Las proteínas están en onzas cocidas.'),
    (v_company, v_protocol, 4,
     'Carbs and fruit are listed in grams cooked.',
     'Los carbohidratos y la fruta están en gramos cocidos.'),
    (v_company, v_protocol, 5,
     'NO cooking oils. Use spray only.',
     'NADA de aceites para cocinar. Usa solo spray.'),
    (v_company, v_protocol, 6,
     'Suggested sprays: coconut oil spray, olive oil spray, or avocado oil spray.',
     'Sprays sugeridos: spray de aceite de coco, de oliva o de aguacate.'),
    (v_company, v_protocol, 7,
     'Only packaged food allowed: Oikos Triple Zero yogurt. NO PROTEIN SHAKES OR BARS OR CHIPS during this phase.',
     'Único alimento empacado permitido: yogur Oikos Triple Zero. NADA DE BATIDOS DE PROTEÍNA, BARRAS NI CHIPS durante esta fase.'),
    (v_company, v_protocol, 8,
     'Season food as you please (salt, pepper, garlic, paprika, lemon, herbs, etc).',
     'Sazona la comida a tu gusto (sal, pimienta, ajo, paprika, limón, hierbas, etc).'),
    (v_company, v_protocol, 9,
     'Drink 80 to 128 oz of water daily.',
     'Toma de 80 a 128 oz de agua al día.'),
    (v_company, v_protocol, 10,
     'If you feel hungry, you may add extra NON-STARCH vegetables (spinach, greens, zucchini, peppers, broccoli).',
     'Si te da hambre, puedes agregar más verduras SIN ALMIDÓN (espinaca, hojas verdes, calabacita, pimientos, brócoli).'),
    (v_company, v_protocol, 11,
     'Do NOT add extra starches (no potatoes, rice, oats, or fruit beyond what is listed).',
     'NO agregues almidones extra (nada de papa, arroz, avena ni fruta además de lo que está en la lista).'),
    (v_company, v_protocol, 12,
     'Eat all 5 meals daily. Consistency > variety.',
     'Come las 5 comidas todos los días. Consistencia > variedad.');

  delete from public.protocol_drink_items where protocol_id = v_protocol;
  insert into public.protocol_drink_items (company_id, protocol_id, sequence, item_en, item_es, amount_en, amount_es)
  values
    (v_company, v_protocol, 1, 'L-Glutamine powder', 'L-glutamina en polvo', '1 scoop', '1 scoop'),
    (v_company, v_protocol, 2, 'Lemon juice', 'Jugo de limón', '30 g', '30 g'),
    (v_company, v_protocol, 3, 'ACV (apple cider vinegar)', 'ACV (vinagre de sidra de manzana)', '15 g', '15 g'),
    -- "INNER FILLET only" is load-bearing: whole-leaf aloe contains aloin, a laxative. Keep the caps.
    (v_company, v_protocol, 4, 'Aloe vera, INNER FILLET only', 'Aloe vera, SOLO EL FILETE INTERNO', '30 g', '30 g');

  delete from public.protocol_meals where protocol_id = v_protocol;
  insert into public.protocol_meals (company_id, protocol_id, sequence, name_en, name_es, kcal, protein_g, carb_g, fat_g)
  values
    (v_company, v_protocol, 1, 'Breakfast', 'Desayuno', 470, 40, 50, 14),
    (v_company, v_protocol, 2, 'Snack',     'Merienda', 160, 15, 17, 0),
    (v_company, v_protocol, 3, 'Lunch',     'Almuerzo', 410, 32, 35, 12),
    (v_company, v_protocol, 4, 'Snack',     'Merienda', 215, 12, 17, 10),
    (v_company, v_protocol, 5, 'Dinner',    'Cena',     300, 35, 32, 3);

  insert into public.protocol_meal_items (company_id, meal_id, sequence, text_en, text_es)
  select v_company, m.id, i.seq, i.en, i.es
  from public.protocol_meals m
  join (values
    (1, 1, '1 whole egg', '1 huevo entero'),
    (1, 2, '200 g egg whites (uncooked)', '200 g de claras de huevo (crudas)'),
    (1, 3, '2 slices Godshall''s turkey bacon', '2 rebanadas de tocino de pavo Godshall''s'),
    (1, 4, '40 g uncooked oats', '40 g de avena cruda'),
    (1, 5, '1 cup unsweetened almond milk', '1 taza de leche de almendra sin azúcar'),
    (1, 6, '100 g fresh blueberries', '100 g de arándanos frescos'),
    (2, 1, '1 single-serve Oikos Triple Zero greek yogurt', '1 yogur griego Oikos Triple Zero individual'),
    (2, 2, '100 g strawberries', '100 g de fresas'),
    (3, 1, '5 oz cooked boneless skinless chicken thighs', '5 oz de muslo de pollo sin hueso ni piel, cocido'),
    (3, 2, '115 g cooked jasmine rice', '115 g de arroz jazmín cocido'),
    (3, 3, '85 g cooked spinach', '85 g de espinaca cocida'),
    (4, 1, '2 hard boiled eggs', '2 huevos cocidos duros'),
    (4, 2, '150 g strawberries or blueberries', '150 g de fresas o arándanos'),
    (5, 1, '5 oz cooked white fish (cod, tilapia or haddock)', '5 oz de pescado blanco cocido (bacalao, tilapia o abadejo)'),
    (5, 2, '120 g sweet potato or red potatoes', '120 g de camote o papa roja'),
    (5, 3, '85 g string green beans FRESH', '85 g de ejotes FRESCOS')
  ) as i(meal_seq, seq, en, es) on i.meal_seq = m.sequence
  where m.protocol_id = v_protocol;

  delete from public.protocol_grocery_items where protocol_id = v_protocol;
  insert into public.protocol_grocery_items
    (company_id, protocol_id, sequence, category_en, category_es, item_en, item_es, quantity_en, quantity_es)
  values
    (v_company, v_protocol,  1, 'Protein', 'Proteína', 'Whole eggs', 'Huevos enteros', '42 large (3 and a half dozen)', '42 grandes (tres docenas y media)'),
    (v_company, v_protocol,  2, 'Protein', 'Proteína', 'Liquid egg whites', 'Claras de huevo líquidas', '~3 quarts', '~3 cuartos de galón'),
    (v_company, v_protocol,  3, 'Protein', 'Proteína', 'Skinless chicken thighs (raw)', 'Muslo de pollo sin piel (crudo)', '6 lbs', '6 lbs'),
    (v_company, v_protocol,  4, 'Protein', 'Proteína', 'White fish (raw)', 'Pescado blanco (crudo)', '5.5 lbs', '5.5 lbs'),
    (v_company, v_protocol,  5, 'Protein', 'Proteína', 'Godshall turkey bacon', 'Tocino de pavo Godshall', '28 slices (2 packs)', '28 rebanadas (2 paquetes)'),
    (v_company, v_protocol,  6, 'Protein', 'Proteína', 'Oikos Triple Zero yogurt', 'Yogur Oikos Triple Zero', '14 single-serve cups', '14 vasos individuales'),
    (v_company, v_protocol,  7, 'Carbs and fruit', 'Carbohidratos y fruta', 'Rolled oats (dry)', 'Avena en hojuelas (seca)', '560 g (~1.25 lbs)', '560 g (~1.25 lbs)'),
    (v_company, v_protocol,  8, 'Carbs and fruit', 'Carbohidratos y fruta', 'White or jasmine rice (dry)', 'Arroz blanco o jazmín (seco)', '532 g (~1.2 lbs)', '532 g (~1.2 lbs)'),
    (v_company, v_protocol,  9, 'Carbs and fruit', 'Carbohidratos y fruta', 'Sweet potatoes (raw)', 'Camote (crudo)', '4 lbs', '4 lbs'),
    (v_company, v_protocol, 10, 'Carbs and fruit', 'Carbohidratos y fruta', 'Blueberries', 'Arándanos', '1.4 kg (~3.1 lbs)', '1.4 kg (~3.1 lbs)'),
    (v_company, v_protocol, 11, 'Carbs and fruit', 'Carbohidratos y fruta', 'Strawberries', 'Fresas', '3.5 kg (~7.7 lbs)', '3.5 kg (~7.7 lbs)'),
    (v_company, v_protocol, 12, 'Vegetables', 'Verduras', 'Spinach / mixed greens (raw)', 'Espinaca u hojas verdes mixtas (crudas)', '2.5 kg (~5.6 lbs)', '2.5 kg (~5.6 lbs)'),
    (v_company, v_protocol, 13, 'Vegetables', 'Verduras', 'Raw green beans', 'Ejotes crudos (green beans)', '1.4 kg (3.1 lbs)', '1.4 kg (3.1 lbs)'),
    (v_company, v_protocol, 14, 'Extras', 'Extras', 'Unsweetened almond milk (30-cal, sugar-free)', 'Leche de almendra sin azúcar (30 cal, sin azúcar)', '14 cups (3.5 quarts)', '14 tazas (3.5 cuartos de galón)'),
    (v_company, v_protocol, 15, 'Extras', 'Extras', 'Cooking spray (coconut, olive oil, or avocado)', 'Spray para cocinar (coco, oliva o aguacate)', null, null),
    (v_company, v_protocol, 16, 'Extras', 'Extras', 'Seasonings', 'Sazonadores', 'salt, pepper, garlic powder, paprika, lemon, herbs', 'sal, pimienta, ajo en polvo, paprika, limón, hierbas');
end
$seed$;
