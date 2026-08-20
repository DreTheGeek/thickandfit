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
import { resolveMemberTier, includesNutrition } from '@/lib/billing/member-tier';

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

/**
 * TWO MESSAGES, CHOSEN BY WHAT SHE ACTUALLY BOUGHT.
 *
 * Owner's rule, and it is the right one: training-only gets training language, nutrition gets
 * nutrition language. The old single message told everybody to start logging their food, which for
 * a training-only member promises a service she did not buy. That is a refund conversation, not a
 * copy nit.
 *
 * The tier arrives already resolved from server-side entitlement state (lib/billing/member-tier.ts),
 * never from a flag the client posted.
 */
function body(
  firstName: string | null,
  locale: 'en' | 'es',
  goalLb: { from: number; to: number } | null,
  nutrition: boolean,
): string {
  const name = (firstName ?? '').trim();

  // Paragraphs are assembled whole and joined with a blank line. The first version built this from
  // sentence fragments joined with '', which silently collapsed the entire message into one wall of
  // text: the '' separators meant as blank lines produced nothing at all.
  // TRAINING-ONLY. Her words, kept as written: structure, progression, honest feedback, and a
  // single next action. No mention of food logging anywhere, because that is the tier boundary.
  const trainingEn: string[] = [
    `Hey${name ? ' ' + name : ''}, you're officially in. I'm Steph. \u{1F90D}`,
    goalLb
      ? `I went through what you sent me, and I saw your goal: ${goalLb.from} \u2192 ${goalLb.to} lb.`
      : 'I went through what you sent me, and I saw your goal.',
    'Your training inside the app is built to give you structure, progression, and a clear plan every time you walk into the gym. No guessing what to do next.',
    'Your first job is simple: start with your first workout and give me honest feedback on how it feels.',
    "If something is too easy, too hard, uncomfortable, or you're unsure about an exercise, use this chat and tell me. The more I know about how you're responding to the training, the better we can keep you moving forward.",
    "You don't need to be perfect. You need to stay consistent.",
    "Show up. Follow the plan. Let's build from there. \u{1F90D}",
  ];

  const trainingEs: string[] = [
    `Hola${name ? ' ' + name : ''}, ya est\u00e1s dentro. Soy Steph. \u{1F90D}`,
    goalLb
      ? `Revis\u00e9 lo que me enviaste y vi tu meta: ${goalLb.from} \u2192 ${goalLb.to} lb.`
      : 'Revis\u00e9 lo que me enviaste y vi tu meta.',
    'Tu entrenamiento en la app est\u00e1 hecho para darte estructura, progresi\u00f3n y un plan claro cada vez que entras al gym. Sin adivinar qu\u00e9 sigue.',
    'Tu primera tarea es simple: empieza con tu primer entrenamiento y dime con honestidad c\u00f3mo se sinti\u00f3.',
    'Si algo se siente muy f\u00e1cil, muy dif\u00edcil, inc\u00f3modo, o no est\u00e1s segura de un ejercicio, escr\u00edbeme por aqu\u00ed. Mientras m\u00e1s s\u00e9 de c\u00f3mo respondes al entrenamiento, mejor te puedo mover hacia adelante.',
    'No necesitas ser perfecta. Necesitas ser constante.',
    'Presentate. Sigue el plan. De ah\u00ed construimos. \u{1F90D}',
  ];

  // NUTRITION TIERS. Everything above plus the food-logging ask, because she is paying for someone
  // to read it.
  const nutritionEn: string[] = [
    `Hey${name ? ' ' + name : ''}, you're officially in. I'm Steph. \u{1F90D}`,
    goalLb
      ? `I already went through what you sent me, and I saw the goal: ${goalLb.from} \u2192 ${goalLb.to} lb.`
      : 'I already went through what you sent me, and I saw the goal.',
    "From here, I'm building this around you. Your starting point, your schedule, how you actually eat, how you train, and what's realistic for your life. You're not getting the same plan everybody else gets.",
    'Your only job today is to give me a real starting point.',
    'Start logging your food exactly how you normally eat. Don\u2019t clean it up because you know I\u2019m looking. Don\u2019t skip the snacks. Don\u2019t try to have a \u201cgood day\u201d for me.',
    'The more honest the data is, the better I can coach you.',
    'And this chat is where we do this together. If something feels off, you\u2019re struggling, you miss a workout, you have a question about food, or you just need me to look at what\u2019s going on, send it here.',
    'You do not need to be perfect for this to work. You just need to keep showing me what\u2019s actually happening so we can adjust.',
    "I'll take care of the strategy.",
    "You show up. I'll coach the rest. \u{1F90D}",
  ];

  const nutritionEs: string[] = [
    `Hola${name ? ' ' + name : ''}, ya est\u00e1s dentro. Soy Steph. \u{1F90D}`,
    goalLb
      ? `Ya revis\u00e9 lo que me enviaste y vi la meta: ${goalLb.from} \u2192 ${goalLb.to} lb.`
      : 'Ya revis\u00e9 lo que me enviaste y vi la meta.',
    'De aqu\u00ed en adelante armo esto alrededor de ti. Tu punto de partida, tu horario, c\u00f3mo comes de verdad, c\u00f3mo entrenas y qu\u00e9 es realista para tu vida. No te va a tocar el mismo plan que a todas.',
    'Tu \u00fanica tarea hoy es darme un punto de partida real.',
    'Empieza a registrar tu comida exactamente como comes normalmente. No la arregles porque sabes que la estoy viendo. No te saltes los snacks. No intentes tener un \u201cd\u00eda bueno\u201d para m\u00ed.',
    'Mientras m\u00e1s honestos sean los datos, mejor te puedo entrenar.',
    'Y este chat es donde hacemos esto juntas. Si algo se siente raro, si te est\u00e1 costando, si te saltas un entreno, si tienes una duda de comida, o si solo necesitas que revise qu\u00e9 est\u00e1 pasando, m\u00e1ndamelo aqu\u00ed.',
    'No necesitas ser perfecta para que esto funcione. Solo necesitas seguir mostr\u00e1ndome lo que de verdad pasa para poder ajustar.',
    'Yo me encargo de la estrategia.',
    'T\u00fa presentate. Del resto me encargo yo. \u{1F90D}',
  ];

  const paras: string[] = nutrition
    ? locale === 'es'
      ? nutritionEs
      : nutritionEn
    : locale === 'es'
      ? trainingEs
      : trainingEn;

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

    // Resolved from entitlement state on the server, never from a flag the client posted. A
    // training-only member must not be told to log her food for a coach who is not reading it.
    const tier = await resolveMemberTier(args.companyId, args.profileId);
    const text = body(args.firstName, args.locale, args.goalLb ?? null, includesNutrition(tier));

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
