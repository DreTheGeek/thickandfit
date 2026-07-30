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

export async function enrollInDrip(
  email: string,
  locale: 'en' | 'es',
): Promise<{ enrolled: boolean; contactId: string | null }> {
  if (!apiKey || !locationId) return { enrolled: false, contactId: null };
  try {
    const res = await fetch(`${BASE}/contacts/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: VERSION,
      },
      body: JSON.stringify({ email, locationId, tags: ['waitlist', `lang:${locale}`] }),
    });
    if (!res.ok) return { enrolled: false, contactId: null };
    const json = (await res.json().catch(() => null)) as { contact?: { id?: string } } | null;
    const contactId = json?.contact?.id ?? null;

    if (contactId && dripWorkflowId) {
      await fetch(`${BASE}/contacts/${contactId}/workflow/${dripWorkflowId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, Version: VERSION },
      }).catch((e: unknown) => {
        // The contact exists but missed the drip enrollment: log it, or the miss is invisible.
        console.error('enrollInDrip workflow:', e instanceof Error ? e.message : e);
      });
    }
    return { enrolled: Boolean(contactId), contactId };
  } catch {
    return { enrolled: false, contactId: null };
  }
}
