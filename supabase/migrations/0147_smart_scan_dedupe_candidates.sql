-- 0147 SMART SCAN: collapse duplicate corpus rows before ambiguity gating.
--
-- The live foods corpus contains the same normalized food name from multiple provenance sources
-- (for example seed + seed_expanded + USDA). Returning those rows independently makes an exact match
-- look ambiguous to the runtime's top-1/top-2 safety check. Preserve the corpus, but emit only the
-- strongest row per normalized name + brand candidate. Authority wins true duplicates while branded
-- foods remain distinct.

create or replace function public.match_food_candidates(
  p_query text,
  p_query_embedding vector(1536) default null,
  p_limit integer default 8
)
returns table (
  id uuid,
  name_en text,
  name_es text,
  brand text,
  category text,
  kcal numeric,
  protein_g numeric,
  carb_g numeric,
  fat_g numeric,
  density_g_per_ml numeric,
  source text,
  is_verified boolean,
  lexical_score double precision,
  trigram_score double precision,
  vector_score double precision,
  authority_score double precision,
  match_score double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select
      lower(regexp_replace(btrim(coalesce(p_query, '')), '\s+', ' ', 'g')) as normalized,
      plainto_tsquery('simple', coalesce(p_query, '')) as tsq
  ),
  scored as (
    select
      f.*,
      case
        when lower(btrim(f.name_en)) = q.normalized then 1.00
        when lower(btrim(coalesce(f.search_text, ''))) = q.normalized then 0.98
        when to_tsvector('simple', coalesce(f.search_text, f.name_en, '')) @@ q.tsq
          then least(0.95, 0.68 + ts_rank_cd(to_tsvector('simple', coalesce(f.search_text, f.name_en, '')), q.tsq)::double precision)
        when lower(coalesce(f.search_text, f.name_en, '')) like '%' || q.normalized || '%' then 0.72
        else 0.0
      end::double precision as lexical,
      similarity(lower(coalesce(f.search_text, f.name_en, '')), q.normalized)::double precision as trigram,
      case
        when p_query_embedding is not null and f.embedding is not null
          then greatest(0.0, 1.0 - (f.embedding <=> p_query_embedding))
        else 0.0
      end::double precision as semantic,
      case
        when f.source = 'coach_override' and f.is_verified then 1.00
        when f.source = 'usda' and f.is_verified then 0.98
        when f.source = 'off' and f.is_verified then 0.95
        when f.is_verified then 0.90
        when f.source = 'usda' then 0.84
        when f.source = 'off' then 0.78
        when f.source in ('ai', 'ai_estimate') then 0.30
        else 0.55
      end::double precision as authority
    from public.foods f
    cross join q
    where q.normalized <> ''
      and (
        lower(coalesce(f.search_text, f.name_en, '')) like '%' || q.normalized || '%'
        or similarity(lower(coalesce(f.search_text, f.name_en, '')), q.normalized) >= 0.24
        or to_tsvector('simple', coalesce(f.search_text, f.name_en, '')) @@ q.tsq
        or (p_query_embedding is not null and f.embedding is not null and 1.0 - (f.embedding <=> p_query_embedding) >= 0.56)
      )
  ),
  fused as (
    select
      s.*,
      greatest(s.lexical, s.trigram * 0.92, s.semantic * 0.86) * 0.82
        + s.authority * 0.18 as fused_score
    from scored s
  ),
  deduped as (
    select
      f.*,
      row_number() over (
        partition by lower(btrim(f.name_en)), lower(btrim(coalesce(f.brand, '')))
        order by
          f.fused_score desc,
          f.authority desc,
          f.is_verified desc,
          case f.source
            when 'coach_override' then 1
            when 'usda' then 2
            when 'off' then 3
            when 'seed_expanded' then 4
            when 'seed' then 5
            when 'ai' then 9
            when 'ai_estimate' then 10
            else 6
          end,
          f.id
      ) as duplicate_rank
    from fused f
  )
  select
    f.id,
    f.name_en,
    f.name_es,
    f.brand,
    f.category,
    f.kcal,
    f.protein_g,
    f.carb_g,
    f.fat_g,
    f.density_g_per_ml,
    f.source,
    f.is_verified,
    f.lexical as lexical_score,
    f.trigram as trigram_score,
    f.semantic as vector_score,
    f.authority as authority_score,
    f.fused_score as match_score
  from deduped f
  where f.duplicate_rank = 1
  order by f.fused_score desc,
           f.is_verified desc,
           f.authority desc,
           length(f.name_en) asc,
           f.id
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

revoke execute on function public.match_food_candidates(text, vector, integer) from public;
revoke execute on function public.match_food_candidates(text, vector, integer) from anon;
grant execute on function public.match_food_candidates(text, vector, integer) to authenticated;
grant execute on function public.match_food_candidates(text, vector, integer) to service_role;

comment on function public.match_food_candidates(text, vector, integer) is
  'Smart Scan hybrid food retrieval. Authenticated/service-role only. SECURITY INVOKER preserves foods RLS. Duplicate corpus rows are collapsed per normalized name+brand before top-candidate ambiguity checks.';
