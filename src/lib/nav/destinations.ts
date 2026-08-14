import type { IconName } from '@/components/ui/icons';

/**
 * Every screen in the product, in one list, with the words people actually type to find them.
 *
 * WHY THIS EXISTS. The member app has five tabs and twenty-four screens. Everything that is not
 * Today, Community, Activities, Nutrition or You is reachable only by finding the right row in a
 * list on the You tab, and nothing tells her that list is where the rest of the app lives. The
 * coach console has the opposite problem: thirty-one items in six collapsible sections, which is a
 * lot to scan when you know exactly where you want to go. Both are the same complaint, "I cannot
 * find it", and both are answered by one search box.
 *
 * KEYWORDS ARE THE POINT, not the labels. A member who wants her macros types "food", "calories",
 * "diet" or "eating", not "Nutrition". A member looking for her measurements types "inches" or
 * "waist". Matching only the visible label tells her the screen does not exist, and she concludes
 * the app cannot do it. Every entry below carries the vocabulary of the person searching, in both
 * languages, because a Spanish member types "comida" and there is no reason to make her guess the
 * English word for a screen she can already see in Spanish.
 *
 * SCOPE, not permission. `audience` decides which list a searcher sees; it is NOT a security
 * boundary. Every destination is independently guarded at the page level by requireEntitled /
 * requireCoach, and that is what actually enforces access. Adding a row here can never grant it.
 */
export type Audience = 'member' | 'coach';

export type NavDestination = {
  /** i18n key inside app.nav.dest, so the label matches the nav she already reads. */
  key: string;
  href: string;
  icon: IconName;
  audience: Audience;
  /**
   * What people type when they want this screen, lowercase, EN and ES together. Not synonyms for
   * their own sake: each one is a word someone would plausibly reach for first.
   */
  keywords: string[];
};

export const DESTINATIONS: NavDestination[] = [
  // --- member ---------------------------------------------------------------
  {
    key: 'today',
    href: '/dashboard',
    icon: 'calendar',
    audience: 'member',
    keywords: ['today', 'home', 'dashboard', 'hoy', 'inicio', 'start', 'mission'],
  },
  {
    key: 'workouts',
    href: '/workouts',
    icon: 'dumbbell',
    audience: 'member',
    keywords: ['workout', 'training', 'program', 'plan', 'gym', 'lift', 'exercise', 'entrenamiento', 'programa', 'rutina'],
  },
  {
    key: 'exercises',
    href: '/exercises',
    icon: 'dumbbell',
    audience: 'member',
    keywords: ['exercise', 'library', 'movement', 'how to', 'demo', 'form', 'ejercicio', 'biblioteca', 'movimiento'],
  },
  {
    key: 'nutrition',
    href: '/nutrition',
    icon: 'nutrition',
    audience: 'member',
    // "log my food" is the single most common intent in this app and the word "nutrition" is not
    // in it.
    keywords: ['food', 'log', 'macros', 'calories', 'eat', 'meal', 'diary', 'scan', 'diet', 'comida', 'calorias', 'macros', 'registrar', 'dieta'],
  },
  {
    key: 'mealPlan',
    href: '/nutrition/plan',
    icon: 'nutrition',
    audience: 'member',
    keywords: ['meal plan', 'plan', 'what to eat', 'grocery', 'shopping', 'recipes', 'plan de comidas', 'que comer', 'compras'],
  },
  {
    key: 'foodPhotos',
    href: '/nutrition/photos',
    icon: 'camera',
    audience: 'member',
    keywords: ['food photos', 'meal photos', 'scans', 'pictures', 'fotos de comida'],
  },
  {
    key: 'community',
    href: '/community',
    icon: 'community',
    audience: 'member',
    keywords: ['community', 'feed', 'posts', 'women', 'group', 'comunidad', 'publicaciones', 'grupo'],
  },
  {
    key: 'inbox',
    href: '/inbox',
    icon: 'chat',
    audience: 'member',
    keywords: ['message', 'chat', 'coach', 'steph', 'talk', 'ask', 'dm', 'mensaje', 'entrenadora', 'hablar', 'preguntar'],
  },
  {
    key: 'checkin',
    href: '/checkin',
    icon: 'clipboard',
    audience: 'member',
    keywords: ['check in', 'checkin', 'weekly', 'form', 'update', 'check-in', 'semanal', 'formulario'],
  },
  {
    key: 'progress',
    href: '/progress',
    icon: 'pulse',
    audience: 'member',
    keywords: ['progress', 'photos', 'before after', 'measurements', 'inches', 'waist', 'progreso', 'fotos', 'medidas', 'cintura'],
  },
  {
    key: 'evolution',
    href: '/evolution',
    icon: 'star',
    audience: 'member',
    keywords: ['evolution', 'journey', 'timeline', 'how far', 'evolucion', 'camino'],
  },
  {
    key: 'weight',
    href: '/you',
    icon: 'ruler',
    audience: 'member',
    keywords: ['weight', 'weigh in', 'scale', 'lbs', 'kg', 'peso', 'bascula', 'pesarme'],
  },
  {
    key: 'health',
    href: '/you/health',
    icon: 'heart',
    audience: 'member',
    keywords: ['health', 'injury', 'injuries', 'allergies', 'medication', 'conditions', 'pcos', 'salud', 'lesiones', 'alergias', 'medicamentos'],
  },
  {
    key: 'cycle',
    href: '/you/cycle',
    icon: 'calendar',
    audience: 'member',
    keywords: ['cycle', 'period', 'menstrual', 'pms', 'ciclo', 'regla', 'periodo'],
  },
  {
    key: 'history',
    href: '/history',
    icon: 'clipboard',
    audience: 'member',
    keywords: ['history', 'past workouts', 'completed', 'historial', 'anteriores'],
  },
  {
    key: 'notifications',
    href: '/notifications',
    icon: 'bell',
    audience: 'member',
    keywords: ['notifications', 'alerts', 'bell', 'notificaciones', 'avisos'],
  },
  {
    key: 'account',
    href: '/account',
    icon: 'gear',
    audience: 'member',
    keywords: ['account', 'settings', 'password', 'email', 'language', 'reminders', 'delete', 'cuenta', 'ajustes', 'idioma', 'contrasena'],
  },
  {
    key: 'billing',
    href: '/account/billing',
    icon: 'card',
    audience: 'member',
    // Someone trying to stop paying types "cancel", and hiding from that word does not keep her.
    keywords: ['billing', 'payment', 'card', 'subscription', 'invoice', 'cancel', 'refund', 'charge', 'pago', 'tarjeta', 'suscripcion', 'cancelar', 'factura'],
  },
  {
    key: 'support',
    href: '/support',
    icon: 'help',
    audience: 'member',
    keywords: ['help', 'support', 'problem', 'broken', 'contact', 'ayuda', 'soporte', 'problema', 'contacto'],
  },

  // --- coach ----------------------------------------------------------------
  { key: 'coachHome', href: '/coach', icon: 'home', audience: 'coach', keywords: ['home', 'dashboard', 'overview', 'revenue', 'mrr', 'kpi'] },
  { key: 'coachClients', href: '/coach/clients', icon: 'user', audience: 'coach', keywords: ['clients', 'crm', 'contacts', 'people', 'roster', 'clientas', 'contactos'] },
  { key: 'coachMembers', href: '/coach/subscribers', icon: 'community', audience: 'coach', keywords: ['members', 'subscribers', 'app accounts', 'signups', 'miembros'] },
  { key: 'coachIntake', href: '/coach/intake', icon: 'clipboard', audience: 'coach', keywords: ['intake', 'review', 'new', 'health forms', 'flags'] },
  { key: 'coachAwaiting', href: '/coach/awaiting', icon: 'clipboard', audience: 'coach', keywords: ['awaiting', 'waiting', 'needs a program', 'queue', 'owed'] },
  { key: 'coachQuiet', href: '/coach/quiet', icon: 'user', audience: 'coach', keywords: ['quiet', 'churn', 'at risk', 'inactive', 'lapsed', 'ghosted', 'stopped', 'retention', 'win back'] },
  { key: 'coachPlanRenewals', href: '/coach/plan-renewals', icon: 'clipboard', audience: 'coach', keywords: ['renewals', 'expiring', 'plan ends', '12 week', 'rewrite', 'next block', 'follow up', 'program ending'] },
  { key: 'coachLeads', href: '/coach/leads', icon: 'funnel', audience: 'coach', keywords: ['leads', 'pipeline', 'prospects', 'waitlist', 'sales'] },
  { key: 'coachInbox', href: '/coach/inbox', icon: 'chat', audience: 'coach', keywords: ['inbox', 'chat', 'messages', 'replies', 'mensajes'] },
  { key: 'coachCommunity', href: '/coach/community', icon: 'community', audience: 'coach', keywords: ['community', 'feed', 'broadcast', 'moderation', 'posts'] },
  { key: 'coachChallenges', href: '/coach/challenges', icon: 'community', audience: 'coach', keywords: ['challenges', 'contest', 'leaderboard'] },
  { key: 'coachDrafts', href: '/coach/drafts', icon: 'file', audience: 'coach', keywords: ['drafts', 'pending', 'unsent'] },
  { key: 'coachApprovals', href: '/coach/approvals', icon: 'clipboard', audience: 'coach', keywords: ['approvals', 'approve', 'review', 'sign off'] },
  { key: 'coachAssignments', href: '/coach/assignments', icon: 'user', audience: 'coach', keywords: ['assignments', 'assistant', 'who has who'] },
  { key: 'coachExercises', href: '/coach/exercises', icon: 'dumbbell', audience: 'coach', keywords: ['exercises', 'movements', 'library', 'demos', 'filming', 'ejercicios'] },
  { key: 'coachSpanish', href: '/coach/spanish', icon: 'book', audience: 'coach', keywords: ['spanish', 'translate', 'translation', 'espanol', 'idioma'] },
  { key: 'coachForms', href: '/coach/forms', icon: 'file', audience: 'coach', keywords: ['forms', 'check-in', 'checkin', 'questionnaire', 'builder'] },
  { key: 'coachMealPlans', href: '/coach/tool/meal-plans', icon: 'nutrition', audience: 'coach', keywords: ['meal plans', 'macros', 'nutrition', 'diet', 'builder', 'plan de comidas'] },
  { key: 'coachRecipeBooks', href: '/coach/tool/recipe-books', icon: 'book', audience: 'coach', keywords: ['recipe books', 'cookbook', 'recetario'] },
  { key: 'coachRecipes', href: '/coach/tool/recipes', icon: 'nutrition', audience: 'coach', keywords: ['recipes', 'food', 'ingredients', 'recetas'] },
  // Keywords are what she would actually type looking for one of these: the titles, not the noun
  // "lesson". "fast food guide" and "nutrition guide" are how she refers to them in chat.
  { key: 'coachLessons', href: '/coach/tool/lessons', icon: 'book', audience: 'coach', keywords: ['lessons', 'guides', 'nutrition guide', 'fast food guide', 'videos', 'content', 'lecciones'] },
  { key: 'coachPrograms', href: '/coach/programs', icon: 'clipboard', audience: 'coach', keywords: ['programs', 'training plans', 'workout builder', 'assign', 'programas'] },
  { key: 'coachBilling', href: '/coach/billing', icon: 'card', audience: 'coach', keywords: ['billing', 'revenue', 'payments', 'stripe', 'subscriptions', 'renewals'] },
  { key: 'coachSettings', href: '/coach/settings', icon: 'gear', audience: 'coach', keywords: ['settings', 'preferences', 'account', 'ajustes'] },
  { key: 'coachClientApp', href: '/coach/settings/client-app', icon: 'grid', audience: 'coach', keywords: ['client app', 'toggles', 'what clients see', 'features', 'permissions'] },
  { key: 'coachCoachingPrefs', href: '/coach/settings/coaching', icon: 'ruler', audience: 'coach', keywords: ['coaching preferences', 'defaults', 'units', 'reminders'] },
  { key: 'coachKnowledge', href: '/coach/settings/knowledge', icon: 'sparkles', audience: 'coach', keywords: ['knowledge', 'method', 'train', 'teach', 'upload', 'pdf', 'interview', 'voice'] },
  { key: 'coachMethod', href: '/coach/method', icon: 'pulse', audience: 'coach', keywords: ['method', 'what it knows', 'status', 'activity', 'assistant'] },
];

/**
 * Rank a destination against a search term. Lower is better; -1 drops it.
 *
 * Four tiers, exactly as the ChairLord playbook has it: exact label, label prefix, label
 * substring, keyword substring. Ranked rather than merely filtered, so typing "me" puts Meal plan
 * above anything that merely contains those two letters. A fixed list of forty-odd destinations
 * does not need a fuzzy matcher, and a hand-written score beats one here because the tiers encode
 * intent: what you typed the START of is what you meant.
 */
export function scoreDestination(label: string, keywords: string[], term: string): number {
  const l = label.toLowerCase();
  const t = term.toLowerCase().trim();
  if (!t) return -1;
  if (l === t) return 0;
  if (l.startsWith(t)) return 1;
  if (l.includes(t)) return 2;
  if (keywords.some((k) => k.includes(t))) return 3;
  return -1;
}

/** Best matches first, capped. The cap is a scan-length decision, not a performance one. */
export function searchDestinations(
  destinations: NavDestination[],
  labelOf: (d: NavDestination) => string,
  term: string,
  limit = 7,
): NavDestination[] {
  return destinations
    .map((d) => ({ d, score: scoreDestination(labelOf(d), d.keywords, term) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((r) => r.d);
}
