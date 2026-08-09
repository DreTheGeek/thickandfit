-- 0120: make coach_knowledge upsertable so a recurring job can own rows in it.
--
-- WHY. coach_knowledge was built for one path only: a coach pastes a document in the UI and
-- ingestKnowledge() INSERTs chunks under a fresh random source_id. Nothing ever re-ran, so no
-- conflict target was needed. The corpus indexer changes that: it re-derives its documents from
-- live tables (her exercise library today, the protocol next) on every run, so it needs to write
-- the same logical row repeatedly without duplicating it. Without a unique index there is no
-- ON CONFLICT target, and "idempotent" would mean read-then-branch with a race in the middle.
--
-- (company_id, source_id, chunk_index) is the logical key the table already behaves as if it had:
-- ingestKnowledge writes chunk_index 0..n under one source_id, and the corpus indexer writes
-- source_id = the origin row's uuid (an exercise id) with chunk_index 0 = English, 1 = Spanish.
-- Verified before creating: zero duplicate (company_id, source_id, chunk_index) groups in prod.
--
-- Also indexes created_by, because system-managed corpus rows are exactly the rows with a NULL
-- created_by and the indexer reads that slice on every run.
create unique index if not exists coach_knowledge_logical_uidx
  on public.coach_knowledge (company_id, source_id, chunk_index);

create index if not exists coach_knowledge_system_idx
  on public.coach_knowledge (company_id)
  where created_by is null;

comment on index public.coach_knowledge_logical_uidx is
  'Conflict target for the corpus indexer. source_id = origin row id, chunk_index = 0 EN / 1 ES.';
