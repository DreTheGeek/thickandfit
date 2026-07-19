-- Tenant-key hardening (launchproof db lens, owner-approved 2026-07-19). Only the columns whose
-- live data PROVES the invariant (zero NULL rows) are tightened; the other flagged columns keep
-- NULL deliberately: exercises/foods company_id NULL means "global catalog row", api_request_log
-- NULLs are anonymous requests, audit_log.user_id NULLs are system events, session_logs NULLs are
-- failed sign-ins (no known user). Those are dismissed in the launchproof ledger, not "fixed".

alter table public.ai_trace alter column company_id set not null;
alter table public.ai_usage_log alter column user_id set not null;
alter table public.audit_log alter column company_id set not null;
alter table public.eval_run alter column company_id set not null;

-- Missing FKs on the hardened keys (ai_usage_log.company_id already has one). Company cascade
-- matches the app-wide pattern; the usage log dies with its profile (analytics, not records).
-- audit_log deliberately gets NO foreign key: audit history must OUTLIVE its tenant (prod already
-- holds audit rows for deleted QA companies, which is correct forensics); a cascade would erase the
-- trail exactly when a tenant vanishes, and NO ACTION would block QA tenant teardown.
alter table public.ai_trace
  add constraint ai_trace_company_id_fkey foreign key (company_id) references public.companies(id) on delete cascade;
alter table public.ai_usage_log
  add constraint ai_usage_log_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.eval_run
  add constraint eval_run_company_id_fkey foreign key (company_id) references public.companies(id) on delete cascade;
