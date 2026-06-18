// Lazy GoHighLevel client. No build-time crash without keys. Creates the contact and enrolls
// it in the waitlist drip workflow. Returns the contact id so success can be confirmed (not silent).
import 'server-only';

const apiKey = process.env.GHL_API_KEY;
const locationId = process.env.GHL_LOCATION_ID;
const dripWorkflowId = process.env.GHL_WAITLIST_WORKFLOW_ID;
const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

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
      }).catch(() => {});
    }
    return { enrolled: Boolean(contactId), contactId };
  } catch {
    return { enrolled: false, contactId: null };
  }
}
