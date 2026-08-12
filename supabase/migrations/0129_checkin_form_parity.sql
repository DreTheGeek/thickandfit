-- Her weekly check-in, as she actually asks it.
--
-- The app shipped a 6-question check-in that nobody wrote for her: "How did this week go?",
-- "Wins this week", "Challenges / opportunities", "Non-scale victory", "Average sleep",
-- "Energy level". Her real Lenus check-in, recovered from 859 submitted responses across 247
-- clients, asks NINETEEN, and only three of ours resemble anything in it.
--
-- That gap is not cosmetic. Migrating her onto a form that drops "Meal plan use", "Workout plan
-- use", "Macros", "Alcohol", "Water", "Steps" and the circumference set would silently delete the
-- questions her coaching actually runs on, and she would find out by opening a check-in and seeing
-- that the thing she reads first is gone.
--
-- Field order is her order. `config.lenus` carries the Lenus block title and type, which is what
-- the importer joins 859 historical responses to; without it the mapping would live only in a
-- script and break the first time either side is edited.
--
-- The two pre-existing responses belong to the sample QA subscriber and reference field ids this
-- migration removes. They are re-pointed at the closest new fields rather than deleted, so the QA
-- account keeps showing a populated check-in.

do $$
declare
  v_company uuid := 'c0ffee00-0000-4000-8000-000000000001';
  v_form uuid := '6b22fe6e-3b90-4910-b437-3bc0640b92eb';
  -- Old field ids, needed to re-point the sample rows before they are dropped.
  v_old_how uuid := 'c02e1fc1-1a3a-4644-9c6f-46b7bf47d30d';
  v_old_wins uuid := 'f6b55543-b8e2-4fb4-9915-9ccc3a4bf64f';
  v_old_chall uuid := '41feb66c-a1dd-4fe8-a04e-2dd78c34cbf9';
  v_old_nsv uuid := 'cf4f2504-6e33-4139-b0b1-fe01ce426a21';
  v_old_sleep uuid := '1a5164a9-eb57-40b9-b636-b601734ad57c';
  v_old_energy uuid := '426b4b18-dfce-46a2-be08-83e911494862';
  -- New field ids. Fixed rather than generated so a re-run is idempotent and the importer can be
  -- read alongside this file without a lookup.
  v_status uuid := 'a1000001-0000-4000-8000-000000000001';
  v_wins uuid := 'a1000001-0000-4000-8000-000000000002';
  v_opps uuid := 'a1000001-0000-4000-8000-000000000003';
  v_nsw uuid := 'a1000001-0000-4000-8000-000000000004';
  v_sleep uuid := 'a1000001-0000-4000-8000-000000000005';
  v_sleepq uuid := 'a1000001-0000-4000-8000-000000000006';
  v_energy uuid := 'a1000001-0000-4000-8000-000000000007';
  v_mood uuid := 'a1000001-0000-4000-8000-000000000008';
begin
  -- Re-point the sample rows FIRST: the answers jsonb is keyed by field id, so once the old fields
  -- are gone there is nothing left to map from.
  update public.form_responses
  set answers = jsonb_strip_nulls(jsonb_build_object(
        v_status::text, answers -> (v_old_how::text),
        v_wins::text, answers -> (v_old_wins::text),
        v_opps::text, answers -> (v_old_chall::text),
        v_nsw::text, answers -> (v_old_nsv::text),
        v_sleep::text, answers -> (v_old_sleep::text),
        v_energy::text, answers -> (v_old_energy::text)
      ))
  where company_id = v_company
    and form_id = v_form
    and answers ?| array[v_old_how::text, v_old_wins::text, v_old_chall::text];

  delete from public.form_fields where company_id = v_company and form_id = v_form;

  insert into public.form_fields (id, company_id, form_id, type, label_en, label_es, config, sort_order, required)
  values
    -- Weight and circumference come back as numbers in metric and are ALSO routed to
    -- weight_entries / body_measurements by the importer. They stay on the form too, because the
    -- member types them here and the trend charts read the dedicated tables.
    (gen_random_uuid(), v_company, v_form, 'measurement', 'Weight', 'Peso',
     '{"lenus":{"title":"Body Measurements","type":"bodyMeasurement","metric":"weight"},"unit":"kg"}'::jsonb, 0, false),
    (gen_random_uuid(), v_company, v_form, 'measurement', 'Circumference', 'Circunferencia',
     '{"lenus":{"title":"Circumference","type":"circumference"},"sites":["chest","upperArm","waist","hip","thigh"],"unit":"cm"}'::jsonb, 1, false),
    (gen_random_uuid(), v_company, v_form, 'photo', 'Progress pictures', 'Fotos de progreso',
     '{"lenus":{"title":"Progress pictures","type":"progressPictures"},"poses":["front","back","side"]}'::jsonb, 2, false),
    (v_status, v_company, v_form, 'multiline', 'Status', 'Estado',
     '{"lenus":{"title":"Status","type":"multiLineText"},"maxLength":500}'::jsonb, 3, false),
    (v_wins, v_company, v_form, 'multiline', 'Wins', 'Logros',
     '{"lenus":{"title":"Wins","type":"multiLineText"}}'::jsonb, 4, false),
    (v_opps, v_company, v_form, 'multiline', 'Opportunities', 'Oportunidades',
     '{"lenus":{"title":"Opportunities","type":"multiLineText"}}'::jsonb, 5, false),
    (v_nsw, v_company, v_form, 'multiline', 'Non scale wins', 'Logros fuera de la báscula',
     '{"lenus":{"title":"Non Scale Wins","type":"multiLineText"}}'::jsonb, 6, false),
    -- Steps and Water are each TWO questions in her form: did you hit it, and what was it. Keeping
    -- both preserves the yes/no she filters on as well as the number she coaches against.
    (gen_random_uuid(), v_company, v_form, 'select', 'Did you hit your step goal?', '¿Alcanzaste tu meta de pasos?',
     '{"lenus":{"title":"Steps","type":"select"},"options":["Yes","No"]}'::jsonb, 7, false),
    (gen_random_uuid(), v_company, v_form, 'multiline', 'Steps', 'Pasos',
     '{"lenus":{"title":"Steps","type":"multiLineText"},"maxLength":300}'::jsonb, 8, false),
    (gen_random_uuid(), v_company, v_form, 'select', 'Did you hit your water goal?', '¿Alcanzaste tu meta de agua?',
     '{"lenus":{"title":"Water","type":"select"},"options":["Yes","No"]}'::jsonb, 9, false),
    (gen_random_uuid(), v_company, v_form, 'multiline', 'Water', 'Agua',
     '{"lenus":{"title":"Water","type":"multiLineText"}}'::jsonb, 10, false),
    (v_sleep, v_company, v_form, 'multiline', 'Sleep', 'Sueño',
     '{"lenus":{"title":"Sleep","type":"multiLineText"},"maxLength":500}'::jsonb, 11, false),
    (v_sleepq, v_company, v_form, 'select', 'Sleep quality', 'Calidad del sueño',
     '{"lenus":{"title":"Sleep quality","type":"sleepQuality"},"scale":[0,10]}'::jsonb, 12, false),
    (gen_random_uuid(), v_company, v_form, 'multiline', 'Alcohol', 'Alcohol',
     '{"lenus":{"title":"Alcohol","type":"multiLineText"}}'::jsonb, 13, false),
    -- Five ratings, all 1 to 5. Mood is a smiley in Lenus and stars everywhere else; the stored
    -- value is the same integer either way, so the difference is presentation, not data.
    (v_energy, v_company, v_form, 'rating', 'Energy level', 'Nivel de energía',
     '{"lenus":{"title":"Energy level","type":"rating"},"scale":5}'::jsonb, 14, false),
    (v_mood, v_company, v_form, 'rating', 'Mood', 'Ánimo',
     '{"lenus":{"title":"Mood","type":"rating","widget":"smiley"},"scale":5}'::jsonb, 15, false),
    (gen_random_uuid(), v_company, v_form, 'rating', 'Workout plan use', 'Uso del plan de entrenamiento',
     '{"lenus":{"title":"Workout plan use","type":"rating"},"scale":5}'::jsonb, 16, false),
    (gen_random_uuid(), v_company, v_form, 'rating', 'Meal plan use', 'Uso del plan de comidas',
     '{"lenus":{"title":"Meal plan use","type":"rating"},"scale":5}'::jsonb, 17, false),
    (gen_random_uuid(), v_company, v_form, 'rating', 'Macros', 'Macros',
     '{"lenus":{"title":"Macros","type":"rating"},"scale":5}'::jsonb, 18, false);
end $$;

comment on table public.form_fields is
  'Form fields. For the weekly check-in, config.lenus maps each field back to the Lenus block it was recovered from, which is the join the historical import uses.';
