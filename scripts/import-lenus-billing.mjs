// Import her Lenus billing: 863 payment installments and the subscription each one belongs to.
//
// Source: .capture/sweep/lenus-extra.json, captured 2026-08-12. Amounts arrive in CENTS already
// (12900 = $129.00), matching the repo's _cents bigint convention.
//
// WHY contact_transactions AND NOT payments. public.payments is keyed on profile_id, has no
// contact_id column at all, and NO coach surface in this app reads it (its one reader is
// getPaymentsForProfile on the member's own /account/billing). Every one of these 863 belongs to
// someone who never claimed an app account. Importing there would produce orphan rows on a screen
// she never opens. contact_transactions is contact-keyed, carries lenus_txn_id, is read by the
// Payments tab, and is already one side of the monthly_revenue union.
//
// THE DOUBLE-COUNT TRAP, measured before writing a line:
//   contact_transactions already holds 1,539 rows from a Lenus CSV export whose lenus_txn_id is a
//   sequential integer. These installments are uuids. Overlap by id: ZERO. Overlap by
//   (contact, day, amount): 553 of 726 settled installments. A naive import would have added five
//   figures of revenue that already exists, to the chart she opens every morning.
//   So the insert is guarded by an existence check on the natural key, and 0134 adds the
//   lenus_txn_id unique index that makes RE-runs safe. Both are needed; neither is sufficient.
//
// SETTLED MONEY ONLY. 60 pending, 48 unpaid, 8 past_due and 21 void are not revenue. A void
// installment in the revenue trend is a lie with a dollar sign on it.
//
// Run: node scripts/import-lenus-billing.mjs [--apply]

import { readFileSync } from 'node:fs';
import { makeSql, runBatched } from './lib/mgmt-sql.mjs';

const APPLY = process.argv.includes('--apply');
const SRC = '.capture/sweep/lenus-extra.json';
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';

// What Lenus considers money that actually arrived. paid_outside_stripe is real: she took some
// payments by other means and recorded them here.
const SETTLED = new Set(['succeeded', 'paid_outside_stripe']);

const sql = makeSql();
const lit = (v) =>
  v === null || v === undefined || v === '' ? 'null'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`;
const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : null);

const doc = JSON.parse(readFileSync(SRC, 'utf8'));
const contacts = sql(`select id, lenus_id from contacts where company_id = '${COMPANY}' and lenus_id is not null`);
const byLenus = new Map(contacts.map((c) => [c.lenus_id, c.id]));

const statements = [];
const stat = { settled: 0, unsettled: {}, noContact: 0, noDate: 0, refunded: 0, zeroed: 0, subs: 0 };

for (const [pid, v] of Object.entries(doc.extra || {})) {
  const p = v.payments;
  if (!p) continue;
  const contactId = byLenus.get(pid);

  for (const i of p.installments || []) {
    if (!SETTLED.has(i.status)) {
      stat.unsettled[i.status] = (stat.unsettled[i.status] || 0) + 1;
      continue;
    }
    if (!contactId) { stat.noContact += 1; continue; }
    // chargedAt, never dueDate. The due date is when the invoice was raised; booking revenue there
    // puts money in the wrong month at every month boundary.
    const occurred = day(i.chargedAt || i.dueDate);
    if (!occurred) { stat.noDate += 1; continue; }

    // amountAfterRefund ONLY when the row is actually flagged as refunded.
    //
    // It arrives as 0 on rows that were never refunded, so reading it unconditionally treats an
    // unpopulated field as "refunded to nothing". That silently dropped 62 settled payments,
    // several of them $339, from her revenue chart. One row in 863 is genuinely refunded; the flag
    // is what says so, not the presence of the number.
    const refunded = Boolean(i.isRefunded || i.isPartiallyRefunded);
    const cents = refunded && Number.isFinite(i.amountAfterRefund) ? i.amountAfterRefund : i.amount;
    if (!Number.isFinite(cents) || cents <= 0) {
      // A charge refunded down to zero is not revenue, and neither is a zero-amount row.
      stat.zeroed += 1;
      continue;
    }
    if (refunded) stat.refunded += 1;
    stat.settled += 1;

    const category = i.isSetupFee ? 'setup_fee' : i.isOneTimePayment ? 'one_time' : 'charge';
    // coach_cents equals gross: this was her own Lenus account with no platform fee split out here,
    // the same reasoning 0128 applies to the Stripe side of the union.
    statements.push(
      `insert into contact_transactions
         (company_id, contact_id, lenus_txn_id, lenus_customer_id, occurred_at, category, gross_cents, coach_cents, currency, source)
       select ${lit(COMPANY)}, ${lit(contactId)}, ${lit(i.id)}, ${lit(pid)}, ${lit(occurred)}, ${lit(category)},
              ${lit(cents)}, ${lit(cents)}, ${lit(String(i.currency || 'USD').toLowerCase())}, 'lenus'
       where not exists (
         select 1 from contact_transactions t
         where t.company_id = ${lit(COMPANY)} and t.contact_id = ${lit(contactId)}
           and t.occurred_at = ${lit(occurred)} and t.gross_cents = ${lit(cents)}
           and t.lenus_txn_id is distinct from ${lit(i.id)}
       )
       on conflict (company_id, lenus_txn_id) where lenus_txn_id is not null
       do update set gross_cents = excluded.gross_cents, coach_cents = excluded.coach_cents,
                     occurred_at = excluded.occurred_at, category = excluded.category;`,
    );
  }

  // The subscription and the period it covers, onto client_subscriptions, which is contact-keyed
  // and already drives the Billing tab and the coach MRR figure.
  const sub = p.subscription;
  const period = p.clientPeriod;
  if (contactId && (sub || period)) {
    const monthly = sub && Number.isFinite(sub.monthlyAmount) ? sub.monthlyAmount : null;
    const status = String(p.subscriptionStatus || (sub && sub.status) || '').toLowerCase();
    // Only the five values the CHECK allows; anything else stays null rather than failing the row.
    const mapped = ['active', 'past_due', 'unpaid', 'canceled', 'churned'].includes(status) ? status : null;
    stat.subs += 1;
    statements.push(
      `update client_subscriptions set
         product_type = coalesce(${lit(period && period.productType ? String(period.productType) : null)}, product_type),
         is_auto_renew = coalesce(${lit(period && typeof period.isAutoRenew === 'boolean' ? period.isAutoRenew : null)}, is_auto_renew),
         started_at = coalesce(${lit(day(period && period.startAt))}::date, started_at),
         ended_at = coalesce(${lit(day(period && period.endAt))}::date, ended_at),
         grandfathered_price_cents = coalesce(${lit(monthly && monthly > 0 ? monthly : null)}, grandfathered_price_cents),
         status = coalesce(${lit(mapped)}, status),
         updated_at = now()
       where company_id = ${lit(COMPANY)} and contact_id = ${lit(contactId)};`,
    );
  }
}

console.log(`settled installments ${stat.settled} | refunded or partially ${stat.refunded} | subscriptions touched ${stat.subs}`);
console.log(`skipped as not settled: ${JSON.stringify(stat.unsettled)}`);
if (stat.noContact) console.log(`skipped, no matching contact: ${stat.noContact}`);
if (stat.noDate) console.log(`skipped, no charge or due date: ${stat.noDate}`);
if (stat.zeroed) console.log(`skipped, nets to zero after refund: ${stat.zeroed}`);

if (!APPLY) {
  console.log(`\nDRY RUN. ${statements.length} statements, nothing written. Re-run with --apply.`);
  process.exit(0);
}

runBatched(sql, 'billing', statements, {
  onProgress: (done, total) => {
    if (done % 300 < 10) console.log(`  ${done}/${total}`);
  },
});
