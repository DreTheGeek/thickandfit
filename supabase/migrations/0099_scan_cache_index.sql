-- 0099: scan determinism cache lookup.
--
-- Same plate scanned twice returned different numbers, because hashInput(image) was computed and
-- stored on every scan and never once read back. Re-scan variance is the single loudest trust
-- complaint in this category: being wrong is forgivable, being inconsistent reads as guessing.
--
-- Member-scoped replay of an identical photo within 24h now skips the vision model entirely, so the
-- same photo yields the same answer. Partial index: only the moat feature's successful rows are ever
-- probed, which keeps this small even as ai_inferences grows with the PRD-A failure corpus.
--
-- Index only. No new table, no RLS change: ai_inferences policies are untouched and the probe reads
-- through the service client exactly as buildScanContext already does.
create index if not exists idx_ai_inferences_scan_cache
  on public.ai_inferences (profile_id, input_hash, created_at desc)
  where feature = 'photo-scan' and status in ('ok', 'product');
