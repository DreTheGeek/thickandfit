'use server';
// Coach composer action: send a message to any client (contact), delivered in-app or by email.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { sendCoachMessageToClient, type DeliveryChannel } from '@/lib/messages/client-messaging';

export type ComposeResult = { ok: boolean; channel?: DeliveryChannel; error?: string };

const Input = z.object({
  contactId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export async function sendClientMessageAction(input: unknown): Promise<ComposeResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const allowed = await checkRateLimit(ctx.userId, 'coach-message', 120, 300);
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const res = await sendCoachMessageToClient(ctx.companyId, ctx.userId, parsed.data.contactId, parsed.data.body);
  if (!res.ok) return res;
  revalidatePath('/coach/inbox');
  revalidatePath(`/coach/clients/${parsed.data.contactId}`);
  return res;
}
