import 'server-only';
import { getTranslations } from 'next-intl/server';
import { getAttention } from '@/lib/coach/attention';
import type { SectionTab } from '@/components/coach/section-tabs';

/**
 * The two groups the sidebar collapsed into one row each.
 *
 * Defined once, here, so a page cannot show a tab row that disagrees with another page's tab row.
 * The failure that produces is subtle and irritating: you arrive on Quiet from a tab list of four
 * and leave from a tab list of three, so the app appears to have lost a screen.
 */

/**
 * WHO NEEDS SOMETHING FROM ME. Four queues, one question.
 *
 * Order is the order the member hits them: she writes an intake note, then waits for a plan, then
 * stops showing up, then her plan runs out. Reading left to right is reading a member's whole
 * lifecycle, which is why they belong on one row.
 */
export async function needsYouTabs(companyId: string | null): Promise<SectionTab[]> {
  const t = await getTranslations('app.coach');
  // Counts come from getAttention, the same query the coach home already runs, so the tab badges
  // and the home tiles cannot disagree about how many people are waiting.
  const items = companyId ? await getAttention(companyId) : [];
  const count = (key: string): number | undefined => items.find((i) => i.key === key)?.count;
  // Ordered by URGENCY, not by lifecycle. The sidebar row lands on the first tab, so the first tab
  // has to be the one with women waiting on it: she paid and has no plan yet, which is the promise
  // /coach/awaiting exists to keep.
  return [
    { href: '/coach/awaiting', label: t('navAwaiting'), count: count('noPlan') },
    { href: '/coach/intake', label: t('navIntake'), count: count('intake') },
    { href: '/coach/quiet', label: t('navQuiet'), count: count('quiet') },
    { href: '/coach/plan-renewals', label: t('navPlanRenewals'), count: count('planRenewals') },
  ];
}

/**
 * THE NUTRITION LIBRARY. Named by the owner as the clearest case: "you get meal plans, recipe
 * books, and recipes. All that could have been in one tab."
 *
 * No counts. These are libraries, not queues: a number beside "Recipes" would say 248 forever and
 * mean nothing, where a number beside "Awaiting a plan" means three women are waiting today.
 */
export async function nutritionTabs(): Promise<SectionTab[]> {
  const t = await getTranslations('app.coach');
  return [
    { href: '/coach/tool/meal-plans', label: t('toolMealPlans') },
    { href: '/coach/tool/recipes', label: t('toolRecipes') },
    { href: '/coach/tool/recipe-books', label: t('toolRecipeBooks') },
  ];
}

/** The training library: her movements, her programs, and the Spanish backfill job over them. */
export async function trainingTabs(): Promise<SectionTab[]> {
  const t = await getTranslations('app.coach');
  return [
    { href: '/coach/programs', label: t('programs') },
    { href: '/coach/exercises', label: t('toolExercises') },
    { href: '/coach/spanish', label: t('navSpanish') },
  ];
}

/**
 * EVERYONE, in the three lists that hold them.
 *
 * Clients and Members were two sidebar rows and are genuinely confusing as two sidebar rows: one is
 * the CRM contact imported from Lenus, the other is the app account. A woman can be in either, both
 * or neither, and nothing on either screen said so. As tabs they read as two views of her people,
 * which is what they are.
 */
export async function peopleTabs(): Promise<SectionTab[]> {
  const t = await getTranslations('app.coach');
  return [
    { href: '/coach/clients', label: t('navClients') },
    { href: '/coach/subscribers', label: t('navMembers') },
    { href: '/coach/leads', label: t('navLeads') },
  ];
}

/** Work the assistant drafted and a human has to sign off. */
export async function approvalTabs(): Promise<SectionTab[]> {
  const t = await getTranslations('app.coach');
  return [
    { href: '/coach/approvals', label: t('navApprovals') },
    { href: '/coach/drafts', label: t('navDrafts') },
    { href: '/coach/assignments', label: t('navAssignments') },
  ];
}

/** What she teaches it, and what it did with what she taught. */
export async function assistantTabs(): Promise<SectionTab[]> {
  const t = await getTranslations('app.coach');
  return [
    { href: '/coach/method', label: t('navMethod') },
    { href: '/coach/settings/knowledge', label: t('navKnowledge') },
  ];
}

/**
 * LEARNING THE CONSOLE. The checklist answers "what have I not done yet"; the manual answers "what
 * IS this and how does it work". They are two halves of the same question and were nowhere near
 * each other, which is how a console with 41 programs and 279 clients in it read as unusable to
 * somebody opening it for the first time.
 */
export async function learnTabs(): Promise<SectionTab[]> {
  const t = await getTranslations('app.coach');
  return [
    { href: '/coach/getting-started', label: t('navGettingStarted') },
    { href: '/coach/training', label: t('navHowTo') },
  ];
}
