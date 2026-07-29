// Shared shape + flattener for "client_subscriptions joined to contacts" reads.
//
// Why this exists as its own module: postgrest-js types an embedded `contacts!inner(...)` select as
// an ARRAY even when the foreign key is to-one, and the runtime shape differs across versions. Both
// the comp-access bulk action and the comp-access page's pending-count need the same normalization,
// and it cannot live in the 'use server' actions file (a server-action module may only export async
// functions - a sync export there is a hard 500 on every action in the file).
export type LegacyContact = { profile_id: string | null; company_id?: string | null };
export type LegacyJoinRow = { contact_id?: string; contacts: LegacyContact | LegacyContact[] | null };

/** Pull every non-null profile_id out of a joined row, whether the embed came back as one object
 *  or a one-element array. */
export function profileIdsFromJoin(row: LegacyJoinRow): string[] {
  const c = row.contacts;
  if (!c) return [];
  const list = Array.isArray(c) ? c : [c];
  return list
    .map((x) => x?.profile_id)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}
