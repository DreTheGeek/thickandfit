// Health profile page. Any authenticated member (trial/free included) can fill it, so it uses
// requireAuth, not requireEntitled. Loads whatever is already on file to prefill, then hands off to
// the client form. Answers write into client_intake, which the coach grounds on immediately.
import type { ReactElement } from "react";
import { requireAuth } from "@/lib/auth/guards";
import { loadHealthProfile } from "@/lib/health-profile/data";
import { HealthProfileForm } from "@/components/health/health-profile-form";

export const dynamic = "force-dynamic";

export default async function HealthProfilePage(): Promise<ReactElement> {
  const ctx = await requireAuth();
  const initial = ctx.companyId
    ? await loadHealthProfile(ctx.userId, ctx.companyId)
    : {
        dietaryExclusions: [],
        allergies: "",
        injuries: [],
        injuriesDescription: "",
        conditions: [],
        safety: [],
        medications: [],
      };
  return <HealthProfileForm initial={initial} />;
}
