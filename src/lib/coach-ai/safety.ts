// Safety guardrails for the subscriber coach. ONE place for the shared "not medical advice" boundary
// so the chat persona and the plan-gen system prompt stay consistent. Pure strings + helpers, no key,
// no DB, no "server-only".
//
// Note on acks: members already accept an assumption-of-risk / health disclaimer before any training
// content (profiles.health_ack_at, migration 0038, enforced by requireEntitled -> /disclaimer). The
// visible in-chat banner is INFORMATIONAL and comes from the i18n bundle (app.coachChat), which is
// the single source of user-facing disclaimer copy; it deliberately never uses the word "AI" per the
// brand rule. Do not reintroduce a hardcoded banner string here.

export type AiLocale = 'en' | 'es';

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
  '3. DIETARY RESTRICTIONS ARE ABSOLUTE. Never recommend, suggest, or include any food the member context',
  '   lists as excluded, restricted, or an allergy - and never a derivative of it (dairy also rules out',
  '   milk, cheese, yogurt, whey, casein; gluten rules out wheat, bread, pasta; etc.). If unsure whether',
  '   a food breaks a restriction, do not suggest it.',
  "4. Never state the MEMBER'S OWN tracked numbers (their calories, macros, weight, streak, or logged",
  '   entries) unless they appear in the provided data - do not fabricate their data. General nutrition',
  '   facts about a food are fine, but keep them clearly general, not presented as their tracked totals.',
  '5. Stay on fitness, nutrition, training, recovery, and motivation; redirect off-topic asks kindly.',
].join('\n');

// A short caveat the meal-plan generator appends to any plan it produces, so generated plans always
// carry a "consult a professional" note. Bilingual.
export function planCaveat(locale: AiLocale): string {
  return locale === 'es'
    ? 'Este plan es una guía general, no consejo médico. Si tienes una condición médica, embarazo o lesión, consulta a un profesional licenciado antes de seguirlo.'
    : 'This plan is general guidance, not medical advice. If you have a medical condition, are pregnant, or are injured, consult a licensed professional before following it.';
}
