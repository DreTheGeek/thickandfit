import 'server-only';
// Steph's first message, waiting in the inbox before she ever writes one.
//
// WHY. The whole premise of this product is her voice and her method. A member who finishes
// onboarding and opens Messages found an empty thread and a prompt to start a conversation with
// someone who had never said anything to her. For a creator-led app that is the wrong first
// impression: it makes the coach feel absent on the one day the member is most willing to engage.
//
// Seeded at ONBOARDING COMPLETION rather than at signup, deliberately. Onboarding is forced before
// the app is reachable, so it is the first moment she is actually inside; and by then her name and
// her goal exist, which is the difference between a form letter and a message that knows who she is.
//
// IDEMPOTENT by existence check: if the thread already has anything in it, this does nothing. A
// member who replies and then somehow re-submits onboarding must never have a second identical
// greeting appear above her own message.
import { createServiceClient } from '@/lib/supabase/service';
import { getCompanyCoach } from '@/lib/tenant/owner';

export type IntroArgs = {
  companyId: string;
  profileId: string;
  firstName: string | null;
  locale: 'en' | 'es';
  /**
   * Her current and goal weight in POUNDS. Numbers, not a pre-formatted string: the join word
   * ("to" vs "a") is language, and passing it in already rendered is how English leaked into the
   * middle of a Spanish message.
   */
  goalLb?: { from: number; to: number } | null;
};

function body(firstName: string | null, locale: 'en' | 'es', goalLb: { from: number; to: number } | null): string {
  const name = (firstName ?? '').trim();

  // Paragraphs are assembled whole and joined with a blank line. The first version built this from
  // sentence fragments joined with '', which silently collapsed the entire message into one wall of
  // text: the '' separators meant as blank lines produced nothing at all.
  const paras: string[] =
    locale === 'es'
      ? [
          `Hola${name ? ' ' + name : ''}, bienvenida. Soy Steph.`,
          goalLb
            ? `Ya vi lo que me contaste: de ${goalLb.from} a ${goalLb.to} lb. Con eso te armo tu plan a mano, no sale de una plantilla.`
            : 'Ya vi lo que me contaste, y con eso te armo tu plan a mano, no sale de una plantilla.',
          'Mientras lo preparo, empieza registrando tu comida. Es lo que más mueve la aguja y además me deja ver cómo comes de verdad, así el plan te queda a ti y no a una persona promedio.',
          'Este chat es directo conmigo. Si algo te confunde, si tuviste una semana difícil, o si simplemente quieres contarme cómo te fue, escríbeme aquí. Te leo.',
          'Vamos con todo. 🤍',
        ]
      : [
          `Hey${name ? ' ' + name : ''}, welcome in. I'm Steph.`,
          goalLb
            ? `I saw what you told me: ${goalLb.from} to ${goalLb.to} lb. I build your plan by hand from that, it does not come out of a template.`
            : 'I saw what you told me, and I build your plan by hand from it. It does not come out of a template.',
          'While I put it together, start by logging your food. It moves the needle most, and it lets me see how you actually eat, so the plan fits you instead of some average person.',
          'This chat comes straight to me. If something is confusing, if you had a rough week, or if you just want to tell me how it went, message me here. I read them.',
          "Let's go. 🤍",
        ];

  return paras.join('\n\n');
}

/**
 * Seed it. Never throws: it runs alongside onboarding submit, and a missing greeting is not worth
 * failing a member's onboarding over.
 */
export async function seedIntroMessage(args: IntroArgs): Promise<{ seeded: boolean }> {
  try {
    const svc = createServiceClient();

    // Already has a thread? Leave it alone.
    const { data: existing } = await svc
      .from('messages')
      .select('id')
      .eq('client_id', args.profileId)
      .limit(1)
      .maybeSingle();
    if (existing) return { seeded: false };

    // The byline: the owner the tenant states, not the oldest coach row. That old ordering put
    // Stephanie first by 36 minutes; a second coach account created earlier that afternoon would
    // have signed every member's first message from her with a nameless dev account. Falls back to
    // no sender rather than inventing one, because an intro apparently written by the wrong person
    // is worse than one with no avatar.
    const senderId = (await getCompanyCoach(args.companyId))?.id ?? null;
    if (!senderId) {
      console.error('seedIntroMessage: no coach in company', args.companyId);
      return { seeded: false };
    }

    const text = body(args.firstName, args.locale, args.goalLb ?? null);

    const { error } = await svc.from('messages').insert({
      company_id: args.companyId,
      client_id: args.profileId,
      sender_id: senderId,
      body: text,
    });
    if (error) {
      console.error('seedIntroMessage insert:', error.message);
      return { seeded: false };
    }

    /**
     * AND into the contact-keyed archive, because that is the thread the COACH reads.
     *
     * This conversation lives in two tables on purpose: `messages` is the live in-app thread the
     * member sees and Realtime delivers, `client_messages` is the contact-keyed archive the coach
     * console renders and the 13,345 imported Lenus messages sit in. sendCoachMessageToClient
     * writes both. This wrote only the first, so Stephanie's welcome was invisible on her own
     * screen: a coach opening that client saw the member's replies and not the message being
     * replied to, which reads as a one-sided thread and as the coach having ignored her.
     *
     * Best effort. The member has her greeting either way, and failing onboarding over an archive
     * row would be the wrong trade.
     */
    const { data: contact } = await svc
      .from('contacts')
      .select('id')
      .eq('company_id', args.companyId)
      .eq('profile_id', args.profileId)
      .maybeSingle();
    const contactId = (contact as { id: string } | null)?.id ?? null;
    if (contactId) {
      const { error: archErr } = await svc.from('client_messages').insert({
        company_id: args.companyId,
        contact_id: contactId,
        profile_id: args.profileId,
        is_from_coach: true,
        sender_name: 'Steph',
        body: text,
        msg_type: 'coach',
        sent_at: new Date().toISOString(),
        source: 'app',
      });
      if (archErr) console.error('seedIntroMessage archive:', archErr.message);
    }

    return { seeded: true };
  } catch (e) {
    console.error('seedIntroMessage:', e instanceof Error ? e.message : e);
    return { seeded: false };
  }
}
