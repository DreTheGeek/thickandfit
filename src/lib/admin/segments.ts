import 'server-only';
// Past-client segmentation (plan item F3) and the launch offer each segment should receive (F5).
//
// This drives who gets what when doors open, so the segment boundaries are stated in data, not vibes.
// Everything below comes from columns already on `contacts`, bridged from the Lenus export at
// migration time: product_type ('bootcamp' | 'personalCoaching' | 'basic') and lifecycle_stage.
//
// What the 2026-07-30 audit of the real rows established:
//   * 125 bootcamp buyers (a one-off purchase; the $129 charge cluster is exactly 1.00 charges per
//     person across 102 people, which corroborates it)
//   * ~130 personal-coaching clients, of whom 76 were still active when Lenus was exported
//   * ~646 leads who never bought
//   * 1 'basic'
//
// The fifth group in the original plan, Solon one-off buyers, is deliberately NOT invented here: that
// list lives in a CSV that has never been imported (F4). A contact is only labelled 'solon' once that
// import actually tags them, so nobody gets the wrong launch offer because a segment was guessed.
import { createServiceClient } from '@/lib/supabase/service';

export type Segment =
  | 'coaching_active'
  | 'coaching_past'
  | 'bootcamp'
  | 'solon'
  | 'lead_never_bought';

export const SEGMENTS: readonly Segment[] = [
  'coaching_active',
  'coaching_past',
  'bootcamp',
  'solon',
  'lead_never_bought',
];

/** Lifecycle values that mean "was paying when the export was taken". */
const PAYING = new Set(['active', 'past_due']);

/**
 * Classify one contact. Pure so it can be unit-tested and reused by an export.
 *
 * Order matters: product_type is the strongest signal, and a bootcamp buyer who later took coaching
 * is counted as coaching, because that is the relationship the launch offer should speak to.
 */
export function segmentFor(input: {
  productType: string | null;
  lifecycleStage: string | null;
  isLegacy?: boolean;
}): Segment {
  const p = (input.productType ?? '').trim().toLowerCase();
  const stage = (input.lifecycleStage ?? '').trim().toLowerCase();

  if (p === 'solon') return 'solon';
  if (p === 'personalcoaching' || p === 'basic') {
    return PAYING.has(stage) ? 'coaching_active' : 'coaching_past';
  }
  if (p === 'bootcamp') return 'bootcamp';
  // No product_type at all: never bought anything from her.
  return 'lead_never_bought';
}

/**
 * The launch offer each segment gets (F5). Encoded here rather than in a doc so the CRM, the export
 * and any future automation all read the same rule.
 *
 * Reasoning behind the split:
 *   * a client who was ACTIVE when Lenus closed is mid-relationship and must transition without a
 *     gap or a price shock, so she is comped into the app rather than sold to
 *   * a lapsed client and a bootcamp buyer already know the work, so the founding rate is the offer
 *   * a lead who never bought gets the normal waitlist funnel, not a "welcome back"
 */
export const SEGMENT_OFFER: Record<Segment, { offer: string; why: string }> = {
  coaching_active: {
    offer: 'comp_transition',
    why: 'Was actively paying at migration. Transition her in with comped access; never make a current client re-buy.',
  },
  coaching_past: {
    offer: 'founding_rate',
    why: 'Knows the coaching already. Founding $19.97 for life is the strongest reactivation hook.',
  },
  bootcamp: {
    offer: 'founding_rate',
    why: 'Bought once and finished. Founding rate turns a one-off buyer into a subscriber.',
  },
  solon: {
    offer: 'founding_rate',
    why: 'One-off product buyer from the Solon list. Same founding hook, once the CSV is imported.',
  },
  lead_never_bought: {
    offer: 'waitlist_funnel',
    why: 'Never purchased. Standard waitlist nurture; a "welcome back" would read as a mistake.',
  },
};

export type SegmentCount = { segment: Segment; count: number; offer: string };

/** Counts per segment for the admin dashboard. */
export async function segmentCounts(companyId: string): Promise<SegmentCount[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('contacts')
    .select('product_type, lifecycle_stage')
    .eq('company_id', companyId);
  if (error) {
    console.error('segmentCounts:', error.message);
    return [];
  }
  const tally = new Map<Segment, number>(SEGMENTS.map((s) => [s, 0]));
  for (const row of (data ?? []) as { product_type: string | null; lifecycle_stage: string | null }[]) {
    const seg = segmentFor({ productType: row.product_type, lifecycleStage: row.lifecycle_stage });
    tally.set(seg, (tally.get(seg) ?? 0) + 1);
  }
  return SEGMENTS.map((s) => ({ segment: s, count: tally.get(s) ?? 0, offer: SEGMENT_OFFER[s].offer }));
}

export type SegmentContact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  segment: Segment;
  productType: string | null;
  lifecycleStage: string | null;
};

/** Contacts in one segment, for review and CSV export (F2: the list Stephanie corrects by hand). */
export async function contactsInSegment(
  companyId: string,
  segment: Segment,
  limit = 1000,
): Promise<SegmentContact[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('contacts')
    .select('id, first_name, last_name, email, phone, product_type, lifecycle_stage')
    .eq('company_id', companyId)
    .limit(limit);
  if (error) {
    console.error('contactsInSegment:', error.message);
    return [];
  }
  return ((data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    product_type: string | null;
    lifecycle_stage: string | null;
  }[])
    .map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      productType: r.product_type,
      lifecycleStage: r.lifecycle_stage,
      segment: segmentFor({ productType: r.product_type, lifecycleStage: r.lifecycle_stage }),
    }))
    .filter((c) => c.segment === segment);
}

/** CSV for the hand-correction pass. Quotes every field so a comma in a name cannot shift columns. */
export function segmentsToCsv(rows: SegmentContact[]): string {
  const esc = (v: string | null): string => `"${(v ?? '').replace(/"/g, '""')}"`;
  const head = ['first_name', 'last_name', 'email', 'phone', 'segment', 'product_type', 'lifecycle_stage', 'offer'];
  const body = rows.map((r) =>
    [
      esc(r.firstName),
      esc(r.lastName),
      esc(r.email),
      esc(r.phone),
      esc(r.segment),
      esc(r.productType),
      esc(r.lifecycleStage),
      esc(SEGMENT_OFFER[r.segment].offer),
    ].join(','),
  );
  return [head.join(','), ...body].join('\n');
}
