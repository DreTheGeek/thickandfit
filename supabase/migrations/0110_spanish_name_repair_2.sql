-- Second pass on the Spanish names, for defects the first check could not see.
--
-- 0109 caught two shapes: whole-string copies of the English, and names opening on a dangling
-- preposition. Regenerating the filming shot list exposed a third shape it missed entirely: a single
-- English word left INSIDE an otherwise Spanish name. "Subida al Cajón de Rodilla Raise",
-- "Sentadilla con Salto Freehand", "Estiramiento Runner'S". Those read as broken to a Spanish
-- speaker and they were all on the shot list, which is the list Stephanie is about to film from.
--
-- And one truncation: "Hyperextensions (Back Extensions)" had become "Extensiones Hiperextensiones
-- (Back", cut mid-parenthesis. Nothing was checking that brackets balanced.
--
-- Deliberately NOT touched: Curl, Press, Pull-over, Skipping, Landmine. Those are the words Spanish
-- speaking lifters actually use, and "translating" them would make the library read worse, not
-- better. The test is whether a member would say it out loud, not whether it appears in a dictionary.

update public.exercises set name_es = case name_en
  -- An English word stranded inside the Spanish
  when 'Step-up with Knee Raise'        then 'Subida al cajón con elevación de rodilla'
  when 'Freehand Jump Squat'            then 'Sentadilla con salto sin peso'
  when 'Runner''s Stretch'              then 'Estiramiento del corredor'
  when 'Incline Inner Biceps Curl'      then 'Curl de bíceps interno inclinado'
  -- Reordered into nonsense
  when 'Single Leg Glute Bridge'        then 'Puente de glúteos a una pierna'
  when 'Stiff-Legged Dumbbell Deadlift' then 'Peso muerto rígido con mancuernas'
  when 'One-Legged Cable Kickback'      then 'Patada de glúteo a una pierna en polea'
  when 'Cross Body Hammer Curl'         then 'Curl martillo cruzado'
  when 'Calf Press On The Leg Press Machine' then 'Press de pantorrillas en prensa'
  -- Grammar: plural noun, singular adjective
  when 'Split Squats'                   then 'Sentadillas divididas'
  -- Truncated mid-parenthesis
  when 'Hyperextensions (Back Extensions)' then 'Hiperextensiones (extensiones lumbares)'
  else name_es
end
where archived_at is null
  and name_en in (
    'Step-up with Knee Raise','Freehand Jump Squat','Runner''s Stretch','Incline Inner Biceps Curl',
    'Single Leg Glute Bridge','Stiff-Legged Dumbbell Deadlift','One-Legged Cable Kickback',
    'Cross Body Hammer Curl','Calf Press On The Leg Press Machine','Split Squats',
    'Hyperextensions (Back Extensions)'
  );
