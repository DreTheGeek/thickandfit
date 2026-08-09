// Server read of the per-company coach settings.
//
// This module is on MEMBER request paths, not just coach ones: the check-in gate, the workout player,
// the recipe detail and isEntitled() all ask it what the coach decided. That is why it is
// request-cached and why it never throws: a settings read that fails must not take down a workout.
//
// Failure policy is "the defaults", not "no access". The defaults in ./settings-shared.ts are the
// permissive, already-shipped behaviour, so an unreachable settings table degrades to the app as it
// worked before this table existed. The one exception is entitlement, which is decided in
// src/lib/billing/entitlement.ts and fails CLOSED on its own terms; this module only tells it whether
// the coach asked for expiry to be honoured, and the default there is yes.
import 'server-only';
import { cache } from 'react';
import { createServiceClient } from '@/lib/supabase/service';
import {
  DEFAULT_COACH_SETTINGS,
  coachSettingsFromRow,
  type CoachSettings,
} from '@/lib/coach/settings-shared';

/**
 * The company's settings. Cached per request, so the four or five surfaces that ask during one page
 * render share a single round trip.
 */
export const readCoachSettings = cache(async (companyId: string | null): Promise<CoachSettings> => {
  if (!companyId) return { ...DEFAULT_COACH_SETTINGS };
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('coach_settings')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) {
    console.error('readCoachSettings:', error.message);
    return { ...DEFAULT_COACH_SETTINGS };
  }
  return coachSettingsFromRow((data as Record<string, unknown> | null) ?? null);
});

/**
 * The same settings, reached from a profile instead of a company.
 *
 * Needed because the member-facing readers that sit lowest in the stack (isEntitled) are handed a
 * profile id and nothing else. Two queries rather than one, which is why the callers that already
 * know the company id must keep using readCoachSettings.
 */
export const readCoachSettingsForProfile = cache(async (profileId: string): Promise<CoachSettings> => {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('profiles')
    .select('company_id')
    .eq('id', profileId)
    .maybeSingle();
  if (error) {
    console.error('readCoachSettingsForProfile:', error.message);
    return { ...DEFAULT_COACH_SETTINGS };
  }
  const companyId = (data as { company_id: string | null } | null)?.company_id ?? null;
  return readCoachSettings(companyId);
});
