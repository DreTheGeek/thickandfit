// Onboarding submit: compute the prediction + targets, store one row per profile.
import { z } from 'zod';
import { withApiLog } from '@/lib/telemetry/request-log';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { onboardingInputSchema, computePlan } from '@/lib/onboarding/prediction';
import { PRIMARY_GOALS } from '@/lib/onboarding/goals';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureCrmContact } from '@/lib/crm/ensure-contact';
import { upsertGhlContact } from '@/lib/ghl/client';
import { sendWelcomeEmail } from '@/lib/email/welcome';
import { seedIntroMessage } from '@/lib/coach/intro-message';
import { assignDefaultCheckin } from '@/lib/checkins/assign-default';
import { autoAssignStarterProgram } from '@/lib/programs/auto-assign';
import { matchStarterPlan, starterCandidates } from '@/lib/programs/match-starter';
import { autoAssignStarterMealPlan } from '@/lib/meal-plans/auto-assign';
import { loadHealthProfile, saveHealthProfile } from '@/lib/health-profile/data';
import { extractIntakeNotes, mergeSlugs } from '@/lib/onboarding/intake-notes';
import {
  INJURIES,
  CONDITIONS,
  PREGNANCY,
  SAFETY,
  EXPERIENCE,
  TRAINING_LOCATION,
} from '@/lib/health-profile/labels';

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
  // The date SHE chose to hit her goal weight. Stored as intent: the coach and the prediction engine
  // both want to know what she is aiming at, separately from what the model projects.
  targetDateIso: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Pre-paywall additions (2026-07-23 call). All optional so an older client build, or a member who
  // skips the health step, still onboards instead of hitting a 422 at the last screen.
  //
  // Phone is stored on the CRM contact (contacts.phone) and pushed to GHL: `profiles` has no phone
  // column, and the CRM contact is what the launch-week text + support flows actually read.
  phone: z.string().trim().min(7).max(32).optional(),
  primaryGoals: z.array(z.enum(PRIMARY_GOALS)).max(PRIMARY_GOALS.length).optional(),
  health: z
    .object({
      injuries: z.array(z.enum(INJURIES)).max(INJURIES.length).default([]),
      conditions: z.array(z.enum(CONDITIONS)).max(CONDITIONS.length).default([]),
      pregnancy: z.enum(PREGNANCY).optional(),
      safety: z.array(z.enum(SAFETY)).max(SAFETY.length).default([]),
      trainingExperience: z.enum(EXPERIENCE).optional(),
      trainingLocation: z.enum(TRAINING_LOCATION).optional(),
      // Decides which of her programs this member starts on. Bounded to the block sizes Stephanie
      // has actually written, so a modified client cannot post 7 and land nowhere.
      trainingDays: z.number().int().min(3).max(5).optional(),
      // Free text, in the member's own words. Capped generously; the extractor truncates further.
      notes: z.string().trim().max(2000).optional(),
    })
    .optional(),
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
      goal_target_date: parsed.data.targetDateIso ?? null,
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

    // Phone -> the CRM contact. Only when the member actually typed one: a blank box must never wipe
    // the number a migrated Lenus contact already has.
    if (parsed.data.phone) {
      const { error: phoneErr } = await supabase
        .from('contacts')
        .update({ phone: parsed.data.phone })
        .eq('company_id', ctx.companyId)
        .eq('profile_id', ctx.userId);
      if (phoneErr) console.error('onboarding phone:', phoneErr.message);
    }

    // Health & safety -> client_intake, the SAME row the coach grounds on, so the very first plan and
    // the first coach reply already know about the member's injuries and conditions.
    //
    // Load-then-merge, not a bare save: saveHealthProfile overwrites the flat columns and replaces
    // custom_fields.healthProfile wholesale, so passing only the pre-paywall subset would blank a
    // migrated Lenus client's dietary exclusions and medications. Merging keeps their imported intake
    // intact while the member's own fresh answers win on the four fields they just filled in.
    const health = parsed.data.health;
    if (health) {
      try {
        const existing = await loadHealthProfile(ctx.userId, ctx.companyId);
        const saved = await saveHealthProfile(ctx.userId, ctx.companyId, {
          ...existing,
          injuries: health.injuries,
          conditions: health.conditions,
          pregnancy: health.pregnancy ?? existing.pregnancy,
          safety: health.safety,
          trainingExperience: health.trainingExperience ?? existing.trainingExperience,
          trainingLocation: health.trainingLocation ?? existing.trainingLocation,
          trainingDays: health.trainingDays ?? existing.trainingDays,
        });
        if (!saved.ok) console.error('onboarding saveHealthProfile: write failed');

        // Free-text intake. The RAW TEXT is written immediately and synchronously, because it is the
        // record: if extraction never runs, or the model is down, the member's own words are still
        // on the row for a human to read. Extraction is an index over it, added afterwards.
        const note = health.notes?.trim();
        if (note) {
          const { error: noteErr } = await supabase
            .from('client_intake')
            .update({ intake_notes: note })
            .eq('company_id', ctx.companyId)
            .eq('profile_id', ctx.userId);
          if (noteErr) console.error('onboarding intake_notes:', noteErr.message);

          // Behind the response: a model call must not make a member wait on the last screen of a
          // wizard they have already finished.
          // Captured as consts: the `if (!ctx.companyId) return` guard above narrows in this scope
          // but not inside a closure created later, where TS widens the property back to string|null.
          const companyId = ctx.companyId;
          const profileId = ctx.userId;
          const runExtraction = async (): Promise<void> => {
            const x = await extractIntakeNotes(note, { companyId, profileId });
            // ADD-ONLY. Union with what she ticked, never replace: "no mention" is not "no", and a
            // model that can clear an injury she selected is one that can get her hurt.
            const merged = await loadHealthProfile(profileId, companyId);
            await saveHealthProfile(profileId, companyId, {
              ...merged,
              injuries: mergeSlugs(merged.injuries ?? [], x.injuries, INJURIES),
              conditions: mergeSlugs(merged.conditions ?? [], x.conditions, CONDITIONS),
              safety: mergeSlugs(merged.safety ?? [], x.safety, SAFETY),
            });
            await supabase
              .from('client_intake')
              .update({ intake_extraction: x, needs_coach_review: x.needsCoachReview })
              .eq('company_id', companyId)
              .eq('profile_id', profileId);
          };
          after(() => runExtraction().catch((e: unknown) => console.error('intake extraction:', e)));
        }
      } catch (e) {
        // Best-effort: the plan is already persisted, so a health-mirror failure must not fail
        // onboarding and strand the member in the wizard. /you/health can capture it later.
        console.error('onboarding saveHealthProfile:', e instanceof Error ? e.message : e);
      }
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
    const { firstName, lastName, language, tier, phone, primaryGoals } = parsed.data;
    after(async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
      const email = (prof as { email?: string | null } | null)?.email;
      if (!email) return;

      // THE WELCOME EMAIL. Before this, absolutely nothing fired when onboarding completed: a member
      // answered every question, landed on a dashboard, and heard nothing from anyone. Sent here
      // rather than before the response because it must never delay or fail her submit, and it rides
      // the email lookup this block already does.
      const m = (plan.macros ?? {}) as { protein_g?: number; carbs_g?: number; fat_g?: number };
      await sendWelcomeEmail({
        companyId,
        to: email,
        firstName,
        targets: {
          calories: Math.round(Number(plan.calories ?? 0)),
          proteinG: Math.round(Number(m.protein_g ?? 0)),
          carbsG: Math.round(Number(m.carbs_g ?? 0)),
          fatG: Math.round(Number(m.fat_g ?? 0)),
        },
        locale: language === 'es' ? 'es' : 'en',
      });

      // Steph's first message, waiting in the inbox before she ever writes one. The premise of this
      // product is her voice; an empty thread on day one makes the coach feel absent on the day the
      // member is most willing to engage. Idempotent, so this cannot double up.
      const nowKg = Number(parsed.data.weightKg ?? 0);
      const goalKg = Number(parsed.data.goalWeightKg ?? 0);
      const toLb = (kg: number): number => Math.round(kg * 2.20462);
      await seedIntroMessage({
        companyId,
        profileId: userId,
        firstName,
        locale: language === 'es' ? 'es' : 'en',
        goalLb: nowKg && goalKg ? { from: toLb(nowKg), to: toLb(goalKg) } : null,
      });

      // Her weekly check-in, assigned now, so the biggest button on her first Today screen works.
      // The hero's primary CTA is "Start Check-in" and /checkin lists only ASSIGNED forms, so
      // without this the loudest control in the product opened "No check-ins assigned yet. Your
      // coach will add one soon." on day one. Same class of fix as the intro message above: the
      // thing that should already be there when she arrives. Idempotent, and it never fails
      // onboarding.
      await assignDefaultCheckin(companyId, userId);

      // A starting program, IF one is configured. Off unless STARTER_PROGRAM_ID is set, so this is
      // inert until someone decides to turn it on; see the module header for why that is a decision
      // rather than a default. Never overrides a coach's own assignment.
      await autoAssignStarterProgram(companyId, userId);

      // And her meal plan, if her tier includes one. Everyone gets a program; a written meal plan is
      // part of what the higher tiers are FOR, so this is gated on tier where the program is not.
      // Same switch shape, same never-override-a-coach rule.
      await autoAssignStarterMealPlan(companyId, userId, tier, language === 'es' ? 'es' : 'en');

      // goal:* tags use the same vocabulary as the waitlist quiz, so a lead who said "lose_fat" at the
      // giveaway lands in the same GHL segment after they become a member.
      const tags = [
        'app-member',
        `tier:${tier ?? 'self'}`,
        `lang:${language ?? 'en'}`,
        ...(primaryGoals ?? []).map((g) => `goal:${g}`),
      ];
      const { contactId } = await upsertGhlContact({ email, firstName, lastName, phone, tags });
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

  /**
   * WHICH PROGRAM SHE IS ABOUT TO BE GIVEN, so the reveal screen can NAME it.
   *
   * The screen said "Program: Personalized training", a static string, which is exactly the kind of
   * sentence a product writes when it has not decided anything. Now that onboarding asks how many
   * days she can train and the matcher reads the answer, the honest version is the program's real
   * name and the days it runs.
   *
   * READ-ONLY, and computed here rather than reusing the assignment's result because the assignment
   * runs in after(), which is after this response has already gone. Same inputs, same deterministic
   * matcher, so the name shown and the plan assigned cannot disagree. Taken from the request body
   * rather than re-read from the profile: this is the copy on a screen, not a grant of access, and
   * the row was written moments ago from these exact values.
   */
  let program: { id: string; name: string; daysPerWeek: number | null; compromised: boolean } | null = null;
  /**
   * The others she could have had, so the reveal can offer a choice rather than an announcement.
   *
   * "Why was that decided for me, and I didn't choose?" Naming the match answers half; this is the
   * other half. Only starter candidates are listed, which is what stops a picker turning into a
   * browse of another member's one-client programming.
   */
  let alternatives: {
    id: string;
    name: string;
    daysPerWeek: number | null;
    level: string | null;
    location: string | null;
  }[] = [];
  {
    const h = parsed.data.health;
    const [match, pool] = await Promise.all([
      matchStarterPlan(ctx.companyId, {
        location: h?.trainingLocation ?? null,
        experience: h?.trainingExperience ?? null,
        daysPerWeek: h?.trainingDays ?? null,
      }),
      starterCandidates(ctx.companyId),
    ]);
    if (match) {
      program = {
        id: match.plan.id,
        name: match.plan.name_en,
        daysPerWeek: match.plan.days_per_week,
        compromised: match.compromised,
      };
    }
    alternatives = pool.map((p) => ({
      id: p.id,
      name: p.name_en,
      daysPerWeek: p.days_per_week,
      level: p.level,
      location: p.location,
    }));
  }

  return apiSuccess({ plan, program, alternatives });
}

export const POST = withApiLog(POST_h);
