-- 0020 Guarantee one client contact per Lenus id so the meal-plan import join cannot fan out
-- into duplicate rows / a non-deterministic contact_id. Partial: leads sharing a lenus_id are
-- unaffected. Current data verified clean (0 duplicate client lenus_ids).
create unique index if not exists uq_contacts_client_lenus
  on public.contacts (company_id, lenus_id)
  where type = 'client' and lenus_id is not null;
