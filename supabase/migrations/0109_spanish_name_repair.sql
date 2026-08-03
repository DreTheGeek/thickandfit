-- Repair the Spanish exercise names a member can see today.
--
-- 20 of the 251 active rows were visibly broken in Spanish, which is half this audience. Two shapes:
--
--   1. Word salad from a machine translation that reordered the English. "Barbell Step Ups" became
--      "de Paso con Barra", opening on a dangling preposition; "Double Leg Butt Kick" became
--      "a Dos Butt Patada de Piernas", which is not a sentence in either language.
--   2. Never translated at all. "Child's Pose" rendered as "Child'S Pose", complete with the
--      capitalised S from a title-caser. That one is filming shot 45.
--
-- Written by hand rather than batched through a model, because 20 items is small enough to get right
-- and each name was checked against the row's own cues. "Power Partials" is not a power movement, the
-- cues describe partial lateral raises; "Rack Pulls" are partial deadlifts from pins.
--
-- Superman is deliberately left as "Superman". It is the accepted name in Spanish gyms, so the two
-- columns matching is correct here rather than a defect.

update public.exercises set name_es = case name_en
  -- Reordered word salad
  when 'Barbell Step Ups'                            then 'Subidas al cajón con barra'
  when 'Dumbbell Step Ups'                           then 'Subidas al cajón con mancuernas'
  when 'Double Leg Butt Kick'                        then 'Talones al glúteo a dos piernas'
  when 'Single Leg Butt Kick'                        then 'Talón al glúteo a una pierna'
  when 'Hip Lift with Band'                          then 'Elevación de cadera con banda'
  when 'Incline Dumbbell Bench With Palms Facing In' then 'Press inclinado con mancuernas y agarre neutro'
  when 'Power Partials'                              then 'Elevaciones laterales parciales'
  when 'V-Bar Pullup'                                then 'Dominadas con agarre en V'
  when 'Weighted Ball Hyperextension'                then 'Hiperextensión sobre balón con peso'
  when 'Wide Stance Stiff Legs'                      then 'Peso muerto rígido con piernas abiertas'
  -- Never translated
  when 'Child''s Pose'                               then 'Postura del niño'
  when 'Fast Skipping'                               then 'Skipping rápido'
  when 'Groiners'                                    then 'Salto de rana desde plancha'
  when 'Landmine 180''s'                             then 'Giros 180 en landmine'
  when 'Rack Pulls'                                  then 'Peso muerto parcial en rack'
  when 'Stomach Vacuum'                              then 'Vacío abdominal'
  when 'Thigh Abductor'                              then 'Abductores en máquina'
  when 'Thigh Adductor'                              then 'Aductores en máquina'
  else name_es
end
where archived_at is null
  and name_en in (
    'Barbell Step Ups','Dumbbell Step Ups','Double Leg Butt Kick','Single Leg Butt Kick',
    'Hip Lift with Band','Incline Dumbbell Bench With Palms Facing In','Power Partials','V-Bar Pullup',
    'Weighted Ball Hyperextension','Wide Stance Stiff Legs','Child''s Pose','Fast Skipping','Groiners',
    'Landmine 180''s','Rack Pulls','Stomach Vacuum','Thigh Abductor','Thigh Adductor'
  );

-- London Bridges is archived rather than translated. Its own cues call for a climbing rope attached
-- to a high beam plus a locked smith machine bar. That is not equipment anyone in this audience has,
-- and naming it in Spanish would only make an unusable row easier to find.
update public.exercises
set archived_at = now(), archive_reason = '2026-08 unusable equipment'
where name_en = 'London Bridges' and archived_at is null and not is_core;
