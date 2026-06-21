// PRD-00 DRY RUN — read-only. Maps all 256 Lenus clients to our schema and reports exactly
// what WOULD be written. Writes NOTHING. PII masked in samples.
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
});
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const ref = (env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase/) || [])[1];
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { error: t.slice(0, 400) }; }
}

const REPORT = `
with src as (
  select c.id, c.first_name, c.last_name, c.email, c.active, c.subscription_status,
         c.product_type, c.start_at, c.end_at, c.is_auto_renew, c.tags,
         ab.monthly_amount, ab.lifetime_paid, ab.billing_health,
         rs.next_amount, rs.next_billing_date, nullif(rs.currency,'') as currency,
         lt.last_txn,
         round(coalesce(nullif(ab.monthly_amount,0), lt.last_txn, nullif(rs.next_amount,0)) * 100)::bigint as price_cents,
         case when nullif(ab.monthly_amount,0) is not null then 'active_billing'
              when lt.last_txn is not null then 'last_transaction'
              when nullif(rs.next_amount,0) is not null then 'renewal_schedule'
              else 'none' end as price_source,
         case when c.subscription_status='active' then 'active' else 'churned' end as status_bucket
  from lenus.clients c
  left join lenus.active_billing ab on ab.client_id = c.id
  left join lenus.renewal_schedule rs on lower(rs.email) = lower(c.email)
  left join lateral (
     select gross_amount_whole as last_txn from lenus.transactions t
     where t.customer_id = c.id order by t.time desc nulls last limit 1
  ) lt on true
)
select
  (select count(*) from src) as total_clients,
  (select count(*) from src s where exists (select 1 from public.profiles p where lower(p.email)=lower(s.email))) as already_in_profiles,
  (select json_agg(x) from (select status_bucket, count(*) from src group by 1) x) as status_split,
  (select json_agg(x) from (select subscription_status as raw, count(*) from src group by 1 order by 2 desc) x) as raw_status,
  (select json_agg(x) from (select price_source, count(*) from src group by 1 order by 2 desc) x) as price_source_split,
  (select count(*) from src where price_cents is null) as missing_price,
  (select count(*) from src where email is null or email='') as missing_email,
  (select coalesce(sum(price_cents),0) from src) as sum_price_cents,
  (select json_agg(x) from (
     select left(coalesce(first_name,''),1)||'.'||left(coalesce(last_name,''),1)||'.' as who,
            left(coalesce(email,''),2)||'***@'||split_part(coalesce(email,''),'@',2) as email_masked,
            status_bucket, price_cents, price_source, coalesce(product_type,'') as product
     from src order by price_cents desc nulls last limit 8
  ) x) as samples;
`;

const DDL = `
-- migration_log: traceability per PRD-00
CREATE TABLE migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lenus_profile_id TEXT NOT NULL,
  target_profile_id UUID REFERENCES profiles(id),
  dataset TEXT NOT NULL,
  records_imported INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','imported','failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE migration_log ENABLE ROW LEVEL SECURITY;

-- client_subscriptions: grandfathered price + status (AC-2, AC-5). Money BIGINT cents.
CREATE TABLE client_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active','churned','unpaid','past_due','canceled')),
  is_legacy BOOLEAN NOT NULL DEFAULT false,
  grandfathered_price_cents BIGINT,
  currency TEXT NOT NULL DEFAULT 'USD',
  product_type TEXT,
  is_auto_renew BOOLEAN,
  started_at DATE,
  ended_at DATE,
  next_billing_date DATE,
  lifetime_paid_cents BIGINT,
  source TEXT NOT NULL DEFAULT 'lenus',
  lenus_client_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

-- legacy_client_snapshot: Lenus engagement counts (no raw history in the export)
CREATE TABLE legacy_client_snapshot (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  meal_plans INT, measurements_logged INT, checkins INT,
  workouts_completed INT, messages_in_window INT, health_assessment INT,
  weight_goal TEXT, goal_intensity TEXT, source TEXT NOT NULL DEFAULT 'lenus',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE legacy_client_snapshot ENABLE ROW LEVEL SECURITY;
`;

(async () => {
  const rows = await q(REPORT);
  console.log('======== PRD-00 DRY RUN (no writes) ========\n');
  console.log(JSON.stringify(rows, null, 2));
  console.log('\n======== PROPOSED NEW TABLES (for your review, not yet applied) ========');
  console.log(DDL);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
