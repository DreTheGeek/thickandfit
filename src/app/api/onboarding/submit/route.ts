// Onboarding submit: compute the prediction + targets, store one row per profile.
import { z } from 'zod';
import { withApiLog } from '@/lib/telemetry/request-log';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { onboardingInputSchema, computePlan } from '@/lib/onboarding/prediction';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureCrmContact } from '@/lib/crm/ensure-contact';
import { upsertGhlContact } from '@/lib/ghl/client';

export const dynamic = 'force-dynamic';

const ONE_YEAR = 60 * 60 * 24 * 365;

// The prediction stats plus the required first + last name and preferred language captured in the
// wizard. First and last name are mandatory (the business requires the client's full legal name).
const submitSchema = onboardingInputSchema.extend({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  language: z.enum(['en', 'es']).optional(),
  // Coaching tier chosen at onboarding (call 2026-07-01). Stored as intent; checkout maps it to a
  // Stripe price when billing goes live. 'team' = coached by Steph's team, not Steph 1-on-1.
  tier: z.enum(['self', 'team', 'steph']).optional(),
});

async function POST_h(req: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON');
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  const plan = computePlan(parsed.data);
  const supabase = createServiceClient();
  const { error: onbErr } = await supabase.from('onboarding_responses').upsert(
    {
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      answers: parsed.data,
      predicted_goal: parsed.data.goal,
      computed_targets: plan,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id' },
  );
  // A silent failure here returned success while homePathForUser kept bouncing the member back to
  // /onboarding forever (the row it checks for never existed). Fail loudly instead.
  if (onbErr) {
    console.error('onboarding submit upsert:', onbErr.message);
    return apiError('Could not save your plan. Please try again.', 500);
  }

  // Persist the captured full name (first + last) + preferred language to the profile.
  const profileUpdate: Record<string, string> = {
    full_name: `${parsed.data.firstName} ${parsed.data.lastName}`,
  };
  if (parsed.data.language) {
    profileUpdate.ui_locale = parsed.data.language;
    profileUpdate.content_locale = parsed.data.language;
  }
  await supabase.from('profiles').update(profileUpdate).eq('id', ctx.userId);

  // Surface the new member in the Clients CRM. Signup alone never wrote a contacts row, so app
  // members were invisible at /coach/clients. Best-effort: a CRM failure must not fail onboarding.
  if (ctx.role === 'subscriber' || ctx.role === 'free') {
    try {
      await ensureCrmContact({
        profileId: ctx.userId,
        companyId: ctx.companyId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        language: parsed.data.language ?? null,
      });
    } catch (e) {
      console.error('onboarding ensureCrmContact:', e instanceof Error ? e.message : e);
    }
    // The chosen tier is the member's plan until Stripe billing exists; surface it in the CRM's
    // Plan column instead of a dash. Only fills the blank, never overwrites a coach-set value.
    const TIER_LABEL: Record<string, string> = {
      self: 'Self-Guided',
      team: 'Team Thick & Fit',
      steph: '1-on-1 with Steph',
    };
    const tierLabel = TIER_LABEL[parsed.data.tier ?? 'self'];
    await supabase
      .from('contacts')
      .update({ product_type: tierLabel })
      .eq('company_id', ctx.companyId)
      .eq('profile_id', ctx.userId)
      .is('product_type', null);
    // Mirror the completed member into GoHighLevel (tags drive Stephanie's automations) and store
    // the GHL id on the CRM contact so pipeline syncs link by id, not just email. after(): the
    // frozen lambda cannot drop it, and a GHL outage never fails onboarding.
    const { userId, companyId } = ctx;
    const { firstName, lastName, language, tier } = parsed.data;
    after(async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
      const email = (prof as { email?: string | null } | null)?.email;
      if (!email) return;
      const tags = ['app-member', `tier:${tier ?? 'self'}`, `lang:${language ?? 'en'}`];
      const { contactId } = await upsertGhlContact({ email, firstName, lastName, tags });
      if (contactId) {
        await supabase
          .from('contacts')
          .update({ ghl_contact_id: contactId })
          .eq('company_id', companyId)
          .eq('profile_id', userId)
          .is('ghl_contact_id', null);
      }
    });
  }

  // Apply the chosen language immediately via cookies so the dashboard loads in it.
  if (parsed.data.language) {
    const store = await cookies();
    store.set('ui_locale', parsed.data.language, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
    store.set('content_locale', parsed.data.language, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
  }

  return apiSuccess({ plan });
}

export const POST = withApiLog(POST_h);
