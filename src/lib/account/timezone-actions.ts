'use server';
// Timezone + reminder-hour writes. The tz machinery (profiles.timezone, localDay, DST-aware
// reminders) has been correct since 0039, but NOTHING ever wrote the user's zone, so every member
// defaulted to the US default and LATAM users (the reason the feature exists) got the wrong local
// day + reminder time. TimezoneSync auto-captures the browser zone; the reminder hour is set in
// account notification prefs.
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export type TzResult = { ok: boolean };

// Validate an IANA zone the same way the DB trigger does: if Intl rejects it, we do too.
function isValidZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Auto-capture the browser's IANA timezone onto the profile. No-ops when unchanged/invalid. */
export async function syncTimezoneAction(tz: unknown): Promise<TzResult> {
  const parsed = z.string().min(1).max(64).safeParse(tz);
  if (!parsed.success || !isValidZone(parsed.data)) return { ok: false };
  const ctx = await requireAuth();
  const sb = await createClient();
  const { data } = await sb.from('profiles').select('timezone').eq('id', ctx.userId).maybeSingle();
  const current = (data as { timezone: string | null } | null)?.timezone ?? null;
  if (current === parsed.data) return { ok: true };
  const { error } = await sb.from('profiles').update({ timezone: parsed.data }).eq('id', ctx.userId);
  if (error) {
    console.error('syncTimezoneAction:', error.message);
    return { ok: false };
  }
  return { ok: true };
}

/** Set the daily reminder hour (0-23, user-local). */
export async function setReminderHourAction(hour: unknown): Promise<TzResult> {
  const parsed = z.number().int().min(0).max(23).safeParse(hour);
  if (!parsed.success) return { ok: false };
  const ctx = await requireAuth();
  const sb = await createClient();
  const { error } = await sb
    .from('profiles')
    .update({ reminder_hour: parsed.data })
    .eq('id', ctx.userId);
  if (error) {
    console.error('setReminderHourAction:', error.message);
    return { ok: false };
  }
  return { ok: true };
}
