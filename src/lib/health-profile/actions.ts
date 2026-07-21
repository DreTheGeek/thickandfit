"use server";
// Server action for the health-profile form. Auth via the session guard (never trusts a client-passed
// id), Zod-validated, then delegates to saveHealthProfile. Returns a small serializable result the
// client renders as success/error.
import { requireAuth } from "@/lib/auth/guards";
import {
  healthProfileSchema,
  saveHealthProfile,
} from "@/lib/health-profile/data";

export type SaveHealthProfileState = { ok: boolean; error?: string };

export async function saveHealthProfileAction(
  input: unknown,
): Promise<SaveHealthProfileState> {
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: "no-company" };

  const parsed = healthProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const res = await saveHealthProfile(ctx.userId, ctx.companyId, parsed.data);
  return res.ok ? { ok: true } : { ok: false, error: "save-failed" };
}
