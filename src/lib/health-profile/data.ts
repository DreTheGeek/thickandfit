import "server-only";
// Health-profile capture: the in-app version of the intake questionnaire. Writes into the SAME
// client_intake row the coach already grounds on (coach-ai/context.ts), so answering here tailors
// the coach immediately. Structured hormonal/medical answers land in custom_fields.healthProfile
// (merged, never clobbering a migrated client's Lenus medical_conditions); the flat columns
// (dietary_exclusions, injuries, allergies, training_experience, sleep_assessment,
// eating_disorder_screening) are written directly. Keyed by (company_id, contact_id) - the only
// unique index on the table - so it unifies with migrated rows instead of creating a duplicate.
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureCrmContact } from "@/lib/crm/ensure-contact";
import {
  DIETARY,
  INJURIES,
  CONDITIONS,
  PREGNANCY,
  SAFETY,
  MEDICATIONS,
  EXPERIENCE,
  SLEEP,
  STRESS,
  FOOD_REL,
} from "@/lib/health-profile/labels";

export const healthProfileSchema = z.object({
  dietaryExclusions: z.array(z.enum(DIETARY)).max(DIETARY.length).default([]),
  allergies: z.string().trim().max(300).default(""),
  injuries: z.array(z.enum(INJURIES)).max(INJURIES.length).default([]),
  injuriesDescription: z.string().trim().max(500).default(""),
  conditions: z.array(z.enum(CONDITIONS)).max(CONDITIONS.length).default([]),
  pregnancy: z.enum(PREGNANCY).optional(),
  safety: z.array(z.enum(SAFETY)).max(SAFETY.length).default([]),
  medications: z.array(z.enum(MEDICATIONS)).max(MEDICATIONS.length).default([]),
  trainingExperience: z.enum(EXPERIENCE).optional(),
  sleep: z.enum(SLEEP).optional(),
  stress: z.enum(STRESS).optional(),
  foodRelationship: z.enum(FOOD_REL).optional(),
});
export type HealthProfileInput = z.infer<typeof healthProfileSchema>;

const EMPTY: HealthProfileInput = {
  dietaryExclusions: [],
  allergies: "",
  injuries: [],
  injuriesDescription: "",
  conditions: [],
  safety: [],
  medications: [],
};

// Keep only values still present in the allowed slug set (guards against an old row holding a slug we
// have since renamed/removed).
function keep<T extends string>(allowed: readonly T[], values: unknown): T[] {
  if (!Array.isArray(values)) return [];
  const set = new Set<string>(allowed);
  return values.filter((v): v is T => typeof v === "string" && set.has(v));
}

function one<T extends string>(
  allowed: readonly T[],
  value: unknown,
): T | undefined {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

type IntakeRow = {
  id: string;
  dietary_exclusions: string[] | null;
  allergies: string | null;
  injuries: string[] | null;
  injuries_description: string | null;
  training_experience: string | null;
  sleep_assessment: Record<string, unknown> | null;
  eating_disorder_screening: Record<string, unknown> | null;
  custom_fields: Record<string, unknown> | null;
};

const INTAKE_COLS =
  "id, dietary_exclusions, allergies, injuries, injuries_description, training_experience, sleep_assessment, eating_disorder_screening, custom_fields";

// Resolve the member's single intake row via their CRM contact. Returns the row (or null) plus the
// contactId, which the save path needs as the upsert key.
async function findIntake(
  profileId: string,
  companyId: string,
): Promise<{ row: IntakeRow | null; contactId: string | null }> {
  const svc = createServiceClient();
  const { data: contact } = await svc
    .from("contacts")
    .select("id")
    .eq("company_id", companyId)
    .eq("profile_id", profileId)
    .limit(1)
    .maybeSingle();
  const contactId = (contact as { id: string } | null)?.id ?? null;
  if (!contactId) return { row: null, contactId: null };
  const { data } = await svc
    .from("client_intake")
    .select(INTAKE_COLS)
    .eq("company_id", companyId)
    .eq("contact_id", contactId)
    .maybeSingle();
  return { row: (data as IntakeRow | null) ?? null, contactId };
}

// Prefill the form from whatever is already on file (a fresh signup gets all-empty; a migrated client
// sees their Lenus dietary/injury data and any prior health-profile answers).
export async function loadHealthProfile(
  profileId: string,
  companyId: string,
): Promise<HealthProfileInput> {
  const { row } = await findIntake(profileId, companyId);
  if (!row) return EMPTY;
  const hp = (row.custom_fields?.healthProfile ?? {}) as Record<
    string,
    unknown
  >;
  const sleep = row.sleep_assessment ?? {};
  const eds = row.eating_disorder_screening ?? {};
  return {
    dietaryExclusions: keep(DIETARY, row.dietary_exclusions),
    allergies: (row.allergies ?? "").trim(),
    injuries: keep(INJURIES, row.injuries),
    injuriesDescription: (row.injuries_description ?? "").trim(),
    conditions: keep(CONDITIONS, hp.conditions),
    pregnancy: one(PREGNANCY, hp.pregnancy),
    safety: keep(SAFETY, hp.safety),
    medications: keep(MEDICATIONS, hp.medications),
    trainingExperience: one(EXPERIENCE, row.training_experience),
    sleep: one(SLEEP, (sleep as Record<string, unknown>).sleep),
    stress: one(STRESS, (sleep as Record<string, unknown>).stress),
    foodRelationship: one(
      FOOD_REL,
      (eds as Record<string, unknown>).selfReport,
    ),
  };
}

export type SaveResult = { ok: boolean };

// Persist the answers. Patches only the columns this form owns and MERGES the jsonb fields, so a
// migrated client's other intake data (goal_type, bmr, Lenus medical_conditions, SCOFF booleans) is
// never lost. Guarantees a CRM contact first (idempotent) so brand-new signups have an upsert key.
export async function saveHealthProfile(
  profileId: string,
  companyId: string,
  input: HealthProfileInput,
): Promise<SaveResult> {
  const svc = createServiceClient();
  let { row, contactId } = await findIntake(profileId, companyId);

  if (!contactId) {
    // No contact yet (e.g. health profile opened before onboarding finished). Create one from the
    // member's profile name, then re-resolve. ensureCrmContact is idempotent and best-effort.
    const { data: prof } = await svc
      .from("profiles")
      .select("full_name, content_locale, ui_locale")
      .eq("id", profileId)
      .maybeSingle();
    const fullName = ((prof as { full_name?: string | null } | null)?.full_name ?? "").trim();
    const parts = fullName ? fullName.split(/\s+/) : [];
    const language = ((
      prof as {
        content_locale?: string | null;
        ui_locale?: string | null;
      } | null
    )?.content_locale ??
      (prof as { ui_locale?: string | null } | null)?.ui_locale ??
      null) as "en" | "es" | null;
    try {
      await ensureCrmContact({
        profileId,
        companyId,
        // A free user may have no name yet; ensureCrmContact needs non-empty strings for the insert.
        firstName: parts[0] || "Member",
        lastName: parts.slice(1).join(" ") || "-",
        language: language === "es" ? "es" : language === "en" ? "en" : null,
      });
    } catch {
      // fall through; re-resolve below
    }
    ({ row, contactId } = await findIntake(profileId, companyId));
  }
  if (!contactId) return { ok: false };

  const prevCustom = (row?.custom_fields ?? {}) as Record<string, unknown>;
  const prevSleep = (row?.sleep_assessment ?? {}) as Record<string, unknown>;
  const prevEds = (row?.eating_disorder_screening ?? {}) as Record<
    string,
    unknown
  >;

  const patch: Record<string, unknown> = {
    company_id: companyId,
    contact_id: contactId,
    profile_id: profileId,
    dietary_exclusions: input.dietaryExclusions,
    allergies: input.allergies || null,
    injuries: input.injuries,
    injuries_description: input.injuriesDescription || null,
    // Merge, do not replace: keep any other jsonb keys already on the row.
    sleep_assessment: {
      ...prevSleep,
      sleep: input.sleep ?? null,
      stress: input.stress ?? null,
    },
    custom_fields: {
      ...prevCustom,
      healthProfile: {
        conditions: input.conditions,
        pregnancy: input.pregnancy ?? null,
        safety: input.safety,
        medications: input.medications,
      },
    },
    source: "app_intake",
    questionnaire_filled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.trainingExperience)
    patch.training_experience = input.trainingExperience;
  // Only touch the ED screen when the member actually answered it, and merge so a migrated SCOFF is
  // preserved. selfReport drives the coach's gentle posture (see scoffPositive in context.ts).
  if (input.foodRelationship) {
    patch.eating_disorder_screening = {
      ...prevEds,
      selfReport: input.foodRelationship,
      disorderedEatingHistory: input.foodRelationship === "struggled",
      prefersLightTracking: input.foodRelationship === "light_tracking",
    };
  }

  const { error } = await svc
    .from("client_intake")
    .upsert(patch, { onConflict: "company_id,contact_id" });
  if (error) {
    console.error("saveHealthProfile upsert:", error.message);
    return { ok: false };
  }
  return { ok: true };
}
