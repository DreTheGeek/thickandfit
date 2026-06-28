// AI safety guardrails for the subscriber AI coach. ONE place for the bilingual "not a medical
// professional" copy so the in-chat disclaimer banner, the chat persona, and the plan-gen system
// prompt all stay consistent. Pure strings + helpers, no key, no DB, no "server-only" (the banner
// copy is consumed by a client component).
//
// Note on acks: members already accept an assumption-of-risk / health disclaimer before any training
// content (profiles.health_ack_at, migration 0038, enforced by requireEntitled -> /disclaimer). The
// in-chat AI banner is INFORMATIONAL and reuses that gate; it does NOT add a second ack column.

export type AiLocale = 'en' | 'es';

// The visible in-chat disclaimer shown above the coach conversation. Short, plain, bilingual.
export type AiDisclaimerCopy = { title: string; body: string };

const DISCLAIMER: Record<AiLocale, AiDisclaimerCopy> = {
  en: {
    title: 'AI coach, not a medical professional',
    body: 'This coach gives general fitness and nutrition guidance based on your data. It is not medical advice. For injuries, pregnancy, medical conditions, or eating-disorder concerns, talk to a licensed professional.',
  },
  es: {
    title: 'Entrenadora con IA, no es una profesional medica',
    body: 'Esta entrenadora ofrece orientacion general de fitness y nutricion basada en tus datos. No es consejo medico. Para lesiones, embarazo, condiciones medicas o trastornos alimenticios, consulta a un profesional licenciado.',
  },
};

export function aiDisclaimer(locale: AiLocale): AiDisclaimerCopy {
  return DISCLAIMER[locale === 'es' ? 'es' : 'en'];
}

// A numbered, explicit safety clause appended to AI system prompts (chat persona + plan-gen). Keeps
// the medical-claim boundary identical everywhere the model speaks. English is fine for the system
// instruction; the model still answers the member in their own language.
export const SAFETY_CLAUSE_EN = [
  'Safety boundaries (always apply):',
  '1. You are not a doctor, dietitian, or licensed medical professional. Never give medical diagnoses,',
  '   prescriptions, or treatment plans.',
  '2. For injuries, pain, pregnancy, nursing, medications, chronic or acute medical conditions, or any',
  '   sign of an eating disorder, recommend the member consult a licensed professional and do not advise',
  '   beyond general, safe fitness and nutrition guidance.',
  '3. Never invent numbers, weights, macros, or logs. Ground every claim in the provided data.',
  '4. Stay on fitness, nutrition, training, recovery, and motivation; redirect off-topic asks kindly.',
].join('\n');

// A short caveat the meal-plan generator appends to any plan it produces, so generated plans always
// carry a "consult a professional" note. Bilingual.
export function planCaveat(locale: AiLocale): string {
  return locale === 'es'
    ? 'Este plan es una guia general, no consejo medico. Si tienes una condicion medica, embarazo o lesion, consulta a un profesional licenciado antes de seguirlo.'
    : 'This plan is general guidance, not medical advice. If you have a medical condition, are pregnant, or are injured, consult a licensed professional before following it.';
}
