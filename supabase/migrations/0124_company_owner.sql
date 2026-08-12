-- Who is the face of this company, stated rather than guessed.
--
-- The member's home screen has a "Your coach" card. It was resolving that name with:
--   select full_name from profiles where company_id = $1 and role in ('operator','coach')
--   order by created_at asc limit 1
-- which is "whichever staff account happened to be created first". On production that is an
-- operator from the agency that BUILT the app, so every member on this creator-led product,
-- whose entire proposition is that Stephanie is your coach, would open the app and be told her
-- coach is someone she has never heard of. The code comment already said "the company's coach
-- (Stephanie)"; the query never expressed it.
--
-- Sort order is not an identity. This states it.
--
-- Nullable on purpose: a company with no owner set falls back to the old ordering, so this
-- migration cannot blank the card for a tenant nobody has filled in yet. on delete set null
-- rather than cascade, because losing the owner's profile must not delete the company.

alter table public.companies
  add column if not exists owner_profile_id uuid references public.profiles (id) on delete set null;

comment on column public.companies.owner_profile_id is
  'The creator whose name and face members see. Not an admin pointer: this is the coach identity shown on the member home screen and anywhere the product speaks as "your coach".';

-- Backfill: the oldest profile with role = coach that actually has a display name. An operator is
-- agency or platform staff and is deliberately NOT eligible here, which is precisely the bug.
update public.companies c
set owner_profile_id = sub.id
from (
  select distinct on (p.company_id) p.company_id, p.id
  from public.profiles p
  where p.role = 'coach'
    and coalesce(nullif(trim(p.full_name), ''), null) is not null
  order by p.company_id, p.created_at asc
) sub
where sub.company_id = c.id
  and c.owner_profile_id is null;
