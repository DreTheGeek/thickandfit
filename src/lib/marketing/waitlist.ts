// Waitlist submit: validate (Zod), store the lead (idempotent), email the magnet, enroll GHL drip.
// Lead is captured even if email/GHL are not configured yet (those return false, not throw).
import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { sendLeadMagnet } from '@/lib/email/resend';
import { enrollInDrip } from '@/lib/ghl/client';

export const waitlistSchema = z.object({
  email: z.string().email(),
  locale: z.enum(['en', 'es']).default('en'),
  source: z.string().max(120).optional(),
});
export type WaitlistInput = z.infer<typeof waitlistSchema>;

const TENANT_SLUG = 'thick-and-fit';

export async function submitWaitlist(input: WaitlistInput) {
  const supabase = createServiceClient();

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', TENANT_SLUG)
    .maybeSingle();
  if (!company) throw new Error('Tenant not configured');

  const { data: lead, error } = await supabase
    .from('waitlist_leads')
    .upsert(
      {
        company_id: company.id,
        email: input.email,
        locale: input.locale,
        source: input.source ?? 'website',
      },
      { onConflict: 'company_id,email' },
    )
    .select('id')
    .single();
  if (error || !lead) throw new Error('Could not store lead');

  const emailed = await sendLeadMagnet(input.email, input.locale);
  const ghl = await enrollInDrip(input.email, input.locale);
  if (ghl.contactId) {
    await supabase.from('waitlist_leads').update({ ghl_contact_id: ghl.contactId }).eq('id', lead.id);
  }

  return { leadId: lead.id, emailed, ghlEnrolled: ghl.enrolled };
}
