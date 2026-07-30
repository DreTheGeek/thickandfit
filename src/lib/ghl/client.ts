// Lazy GoHighLevel client. No build-time crash without keys. Creates the contact and enrolls
// it in the waitlist drip workflow. Returns the contact id so success can be confirmed (not silent).
import 'server-only';

// One GHL credential, two historical names. Read TOKEN first, fall back to KEY, so whichever the
// operator set works for both the waitlist drip (here) and the pipeline sync (coach/ghl-sync.ts).
const apiKey = process.env.GHL_API_TOKEN ?? process.env.GHL_API_KEY;
const locationId = process.env.GHL_LOCATION_ID;
const dripWorkflowId = process.env.GHL_WAITLIST_WORKFLOW_ID;
const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

export type GhlUpsertInput = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  // Optional so a blank phone is OMITTED from the payload rather than sent as empty. GHL treats an
  // empty string as a write, which would blank the number a migrated Lenus contact already has.
  phone?: string | null;
  tags: string[];
};

// Idempotent create-or-update by email (POST /contacts/upsert). GHL tags are additive on upsert, so
// an existing lead keeps its pipeline tags and gains the app ones. Never throws: GHL being down
// must not block signup or onboarding.
export async function upsertGhlContact(
  input: GhlUpsertInput,
): Promise<{ ok: boolean; contactId: string | null }> {
  if (!apiKey || !locationId) return { ok: false, contactId: null };
  try {
    const res = await fetch(`${BASE}/contacts/upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: VERSION,
      },
      body: JSON.stringify({
        locationId,
        email: input.email,
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        tags: input.tags,
      }),
    });
    if (!res.ok) {
      console.error('upsertGhlContact:', res.status, (await res.text()).slice(0, 160));
      return { ok: false, contactId: null };
    }
    const json = (await res.json().catch(() => null)) as { contact?: { id?: string } } | null;
    return { ok: true, contactId: json?.contact?.id ?? null };
  } catch (e) {
    console.error('upsertGhlContact:', e instanceof Error ? e.message : e);
    return { ok: false, contactId: null };
  }
}

/**
 * Put a waitlist lead into GoHighLevel, then optionally into the drip workflow.
 *
 * Uses upsertGhlContact rather than its own POST /contacts/ call. That separate create path was
 * failing silently in production: a probe signup on 2026-07-30 landed in waitlist_leads but never
 * reached GHL (ghl_contact_id null), while the onboarding path through upsert linked 2/2. GHL's
 * create endpoint rejects an existing contact, and the old code returned {enrolled:false} without
 * logging the status, so every miss was invisible. Two code paths to the same vendor is how that
 * drift survives; now there is one.
 *
 * Name and phone are passed through so the contact is not anonymous. A drip that opens "Hey ," is
 * worse than no drip.
 *
 * The workflow enrollment is BEST-EFFORT and optional: without GHL_WAITLIST_WORKFLOW_ID the contact
 * and its tags still land, which is all a tag-triggered workflow needs (see
 * .planning/GHL-WAITLIST-WORKFLOW-SPEC.md).
 */
export async function enrollInDrip(
  email: string,
  locale: 'en' | 'es',
  profile: { firstName?: string | null; lastName?: string | null; phone?: string | null } = {},
): Promise<{ enrolled: boolean; contactId: string | null }> {
  if (!apiKey || !locationId) return { enrolled: false, contactId: null };

  const { ok, contactId } = await upsertGhlContact({
    email,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    phone: profile.phone ?? null,
    tags: ['waitlist', `lang:${locale}`],
  });
  if (!ok || !contactId) {
    console.error('enrollInDrip: contact upsert failed for', email);
    return { enrolled: false, contactId: null };
  }

  if (dripWorkflowId) {
    try {
      const res = await fetch(`${BASE}/contacts/${contactId}/workflow/${dripWorkflowId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, Version: VERSION },
      });
      // Log the STATUS, not just an exception: a 4xx here is the common failure and it does not throw.
      if (!res.ok) {
        console.error('enrollInDrip workflow:', res.status, (await res.text()).slice(0, 160));
      }
    } catch (e) {
      console.error('enrollInDrip workflow:', e instanceof Error ? e.message : e);
    }
  }

  return { enrolled: true, contactId };
}
