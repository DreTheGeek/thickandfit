'use server';
// Notification preferences: read + upsert the signed-in user's per-category, per-channel toggles.
// Backed by the EXISTING public.notification_preferences table (0001_foundation.sql) with a UNIQUE
// (user_id, channel, category) for clean upserts. Service client (the action is already auth-gated).
//
// Enforcement: createNotification (src/lib/notifications/create.ts) reads isPushAllowed before firing
// a web push and suppresses pushes the user turned off (default-on when no row exists). Transactional/
// legal channels (the `billing` category + the `email` channel) are LOCKED ON and cannot be disabled.
//
// Pure helpers + constants live in ./notification-preferences-shared (a 'use server' file may only
// export async functions).
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  isLockedOn,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPrefMap,
} from '@/lib/account/notification-preferences-shared';

function defaultPrefs(): NotificationPrefMap {
  const map = {} as NotificationPrefMap;
  for (const category of NOTIFICATION_CATEGORIES) {
    map[category] = {} as Record<NotificationChannel, boolean>;
    for (const channel of NOTIFICATION_CHANNELS) {
      // Default ON: a missing row means "not yet customized", which is opt-in.
      map[category][channel] = true;
    }
  }
  return map;
}

/**
 * Read the user's preferences folded into a {category: {channel: enabled}} map.
 * Missing rows default to ON. Locked pairs (billing / email) are forced ON regardless of any
 * stored value, so the UI and the send path agree.
 */
export async function readMyNotificationPrefs(): Promise<NotificationPrefMap> {
  const ctx = await requireAuth();
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('notification_preferences')
    .select('channel, category, enabled')
    .eq('user_id', ctx.userId);
  if (error) console.error('readMyNotificationPrefs:', error.message);

  const map = defaultPrefs();
  for (const row of data ?? []) {
    const category = row.category as NotificationCategory;
    const channel = row.channel as NotificationChannel;
    if (NOTIFICATION_CATEGORIES.includes(category) && NOTIFICATION_CHANNELS.includes(channel)) {
      map[category][channel] = Boolean(row.enabled);
    }
  }
  // Locked pairs are always on, whatever the DB says.
  for (const category of NOTIFICATION_CATEGORIES) {
    for (const channel of NOTIFICATION_CHANNELS) {
      if (isLockedOn(category, channel)) map[category][channel] = true;
    }
  }
  return map;
}

const setPrefSchema = z.object({
  category: z.enum(NOTIFICATION_CATEGORIES),
  channel: z.enum(NOTIFICATION_CHANNELS),
  enabled: z.boolean(),
});

export type SetPrefState = { ok?: boolean; error?: string };

/**
 * Upsert one (category, channel) toggle. Refuses to disable a locked pair. Upserts on the
 * UNIQUE (user_id, channel, category) constraint so repeated toggles update in place.
 */
export async function setNotificationPref(input: {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}): Promise<SetPrefState> {
  const ctx = await requireAuth();
  if (!ctx.companyId) return { error: 'noCompany' };

  const parsed = setPrefSchema.safeParse(input);
  if (!parsed.success) return { error: 'invalid' };

  const { category, channel, enabled } = parsed.data;
  // Locked pairs cannot be turned off; force the stored value on.
  const finalEnabled = isLockedOn(category, channel) ? true : enabled;

  const svc = createServiceClient();
  const { error } = await svc.from('notification_preferences').upsert(
    {
      company_id: ctx.companyId,
      user_id: ctx.userId,
      channel,
      category,
      enabled: finalEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,channel,category' },
  );
  if (error) {
    console.error('setNotificationPref:', error.message);
    return { error: 'saveFailed' };
  }
  return { ok: true };
}

/**
 * Send-path check: is a push for a profile + category allowed? Default ON (no row), billing always
 * ON. Called by createNotification so the prefs UI actually enforces.
 */
export async function isPushAllowed(
  profileId: string,
  category: NotificationCategory,
): Promise<boolean> {
  if (category === 'billing') return true; // transactional/legal: always delivered
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('notification_preferences')
    .select('enabled')
    .eq('user_id', profileId)
    .eq('channel', 'push')
    .eq('category', category)
    .maybeSingle();
  if (error || !data) return true; // default ON / fail open
  return Boolean(data.enabled);
}
