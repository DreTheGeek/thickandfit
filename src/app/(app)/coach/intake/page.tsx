// Intake review queue: new members whose free-text note needs a human read before a plan is built.
//
// The extractor deliberately over-flags (pregnancy, recent surgery, chest pain, fainting, ED history,
// named medications, and anything it is unsure about). That bias is only defensible because this page
// exists: a flag nobody looks at is worse than no flag, since it creates the belief that someone is
// checking.
import type { ReactElement } from 'react';
import { requireCoach } from '@/lib/auth/guards';
import { listIntakeReviews } from '@/lib/coach/intake-review';
import { IntakeReviewQueue } from '@/components/coach/intake-review-queue';
import { PageTitle } from '@/components/ui/section';

export const dynamic = 'force-dynamic';

export default async function CoachIntakePage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const items = ctx.companyId ? await listIntakeReviews(ctx.companyId) : [];

  return (
    <div className="px-[22px] py-6">
      <PageTitle className="mb-2">Intake to review</PageTitle>
      <p className="mb-5 max-w-[62ch] text-[13px] leading-relaxed text-faint">
        What a member wrote in her own words at signup, when it mentions something worth a human read.
        Her text is shown in full; the tags underneath are a read of it, not a replacement for it.
      </p>
      <IntakeReviewQueue items={items} />
    </div>
  );
}
