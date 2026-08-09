-- Filming progress that survives closing the tab.
--
-- Stephanie is filming her library with a videographer three times a week. We gave her a checklist
-- as a static document and she reported back on the 6 Aug call: "when I try to input that checklist
-- on Google Chrome, it doesn't show me what I've already completed ... it completely put it at 0%.
-- It doesn't save what I complete."
--
-- She was right, and the checkbox was the lie: a published document has nowhere to write to, so the
-- ticks lived in one browser tab and died with it. Progress against a 367-item list is real state
-- about her business, so it belongs in the database next to the exercise it describes.
--
-- Nullable, no default: null means "not filmed yet", which is the honest state for all 367 today.

alter table public.exercises
  -- When SHE filmed it for this app. Distinct from lenus_video_key (her old Lenus footage, which we
  -- are rescuing separately) and from video_mux_id / is_own_demo, which mean "playable in the app"
  -- and are owned by the Mux webhook. A row can have Lenus footage and still be unfilmed here,
  -- which is exactly the case she is working through.
  add column if not exists filmed_at timestamptz,

  -- Her note to herself or to the editor: a retake, a cue she wants overlaid, a variation to skip.
  add column if not exists filming_note text;

comment on column public.exercises.filmed_at is
  'When Stephanie filmed this movement for the app. Null = still on the shot list.';
comment on column public.exercises.filming_note is
  'Free note from the shoot: retake, cue to overlay, variation to skip.';

-- Partial index: every read of the shot list asks "what is left", and that is a small slice of a
-- 1,259-row table.
create index if not exists idx_exercises_unfilmed
  on public.exercises (company_id)
  where is_coach_authored and filmed_at is null and archived_at is null;
