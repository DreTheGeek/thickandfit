import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * The walkthrough of the coaching console.
 *
 * WHAT WAS WRONG WITH THE LAST ONE, and it is worth writing down because it looked finished:
 * fourteen checkboxes that ticked when you VISITED a screen. Visiting teaches nothing. It told a
 * new coach that a screen exists and left her to work out what it was for, which is the same
 * position as having no walkthrough at all, only with a progress bar over it. The owner's verdict
 * was "this still isn't the onboarding that I was talking about", and he was right.
 *
 * THREE THINGS EACH STAGE HAS TO CARRY, all missing before:
 *   why       one line, in her language, on what this is FOR. Not the feature name again.
 *   how       the steps, in the order somebody actually does them.
 *   watchOut  what trips people up, written BEFORE they hit it rather than after.
 *
 * DERIVED FROM REAL DATA WHEREVER REAL DATA CAN PROVE IT. `derivedFrom: null` means nothing in the
 * database can answer it and she ticks it herself. A stored "I did that" flag for something the
 * database already knows is a lie waiting to happen: she assigns a program, the flag never gets
 * set, and the console spends the next year telling her to do a thing she has done.
 *
 * WRITTEN AS DATA, not as pages, so one stage can appear on Getting Started, in the command
 * palette, and as a nudge on the screen it describes, without the words living in three places and
 * drifting apart.
 *
 * ON LANGUAGE. This is English-only, and deliberately so rather than by omission. The coach console
 * has four users and they all work in English; the MEMBER app is the bilingual surface and every
 * string a member can see is in both catalogs. Putting a 2,000-word manual through the message
 * catalogs would double the writing and halve the chance any of it stays true. If a Spanish-first
 * coach is ever hired, add a `locale` field here and a second array; nothing else has to change.
 */

export type StageTier = 'dayOne' | 'makeItYours';

export type OnboardingStage = {
  key: string;
  title: string;
  /** One line on why this is worth the minutes. */
  why: string;
  tier: StageTier;
  minutes: number;
  href: string;
  cta: string;
  how: string[];
  watchOut?: string;
  /** The article that goes deeper, by slug. */
  learnMore?: string;
  /** How the app knows this is done. Null means she ticks it herself. */
  derivedFrom: string | null;
};

export const ONBOARDING_INTRO = {
  title: 'What this actually is',
  body:
    'Everything you used to do across Lenus, your notes app and your DMs, in one place: your clients, '
    + 'their programs, their food, the messages, and the assistant that knows how you coach. '
    + 'Nothing goes out to a client automatically unless you switch it on.',
  points: [
    'The left menu is grouped by what you are doing, not by what screens exist. Most rows open with tabs across the top.',
    'Your 41 programs, 279 clients and 366 filmed demos came across from Lenus. Nothing here is empty.',
    'Anything that messages a client on your behalf waits for you in Approvals first.',
  ],
};

export const ONBOARDING: OnboardingStage[] = [
  // ------------------------------------------------------------------------------- day one
  {
    key: 'people',
    title: 'Find one of your clients',
    why: 'Everything else in here hangs off a client record. Open one and you have seen most of the console.',
    tier: 'dayOne',
    minutes: 4,
    href: '/coach/clients',
    cta: 'Open your client list',
    how: [
      'People in the sidebar. Three tabs: Clients is everyone who came across from Lenus, Members is who has an app account, Leads is who has not paid yet.',
      'Search her name and open her. Her weight history, her check-ins, her photos and every message you have ever exchanged are on that one page.',
      'The Coach and access card at the bottom is where you pause her, or hand her to another coach.',
    ],
    watchOut:
      'A woman can be a Client without being a Member. That means she is in your records but has not claimed her app login yet, so she cannot log anything. The invite queue is how you reach her.',
    learnMore: 'client-record',
    derivedFrom: 'contacts',
  },
  {
    key: 'needsYou',
    title: 'Work the Needs you queue',
    why: 'Four lists of women waiting on something from you, in one place. This is the screen to open every morning.',
    tier: 'dayOne',
    minutes: 5,
    href: '/coach/awaiting',
    cta: 'Open Needs you',
    how: [
      'Awaiting a plan: she paid and has no program yet. The app told her you write these by hand, so this queue is what keeps that sentence true.',
      'Intake to review: she wrote something at signup worth a human read. Injuries, pregnancy, medication, anything the extractor was unsure about.',
      'Gone quiet: she stopped logging. Seven, fourteen and twenty-eight days. She gets an automatic nudge at each; the twenty-eight day one promises that you will reach out personally.',
      'Plans running out: her twelve weeks are nearly up. A week of warning is the difference between rewriting a plan and letting one expire under a paying client.',
    ],
    watchOut:
      'The day-28 nudge tells her a coach is going to reach out personally. That message is only honest if somebody reads this queue.',
    learnMore: 'needs-you',
    derivedFrom: null,
  },
  {
    key: 'assign',
    title: 'Give somebody a program',
    why: 'The single most valuable thing this console does, and it takes about thirty seconds once you know where it is.',
    tier: 'dayOne',
    minutes: 6,
    href: '/coach/awaiting',
    cta: 'Assign a program',
    how: [
      'From Needs you, open anyone in Awaiting a plan.',
      'Pick a program from the library. All 41 of yours are there, with the number of days and how many movements have your footage.',
      'Assign. She sees it on her Today screen immediately, with your demo playing on every movement.',
    ],
    watchOut:
      'Running a client through a block she has done before updates the existing assignment rather than adding a second one, and the start date moves to today. That is what you want; it is worth knowing so the change of date does not surprise you.',
    learnMore: 'assigning-a-program',
    derivedFrom: 'plan_assignments',
  },
  {
    key: 'reply',
    title: 'Answer somebody',
    why: 'Her chat with you is the thing she is really paying for. It is also where she tells you the plan is too hard before she quietly stops doing it.',
    tier: 'dayOne',
    minutes: 3,
    href: '/coach/inbox',
    cta: 'Open your chat',
    how: [
      'Chat in the sidebar. Newest first, unanswered at the top.',
      'Her recent workouts, her weight and her last check-in sit beside the thread, so you are not guessing who she is while you type.',
      'Everything you send lands in her app, not an email.',
    ],
    watchOut:
      'Unanswered messages are counted over fourteen days on your home screen. Older than that is not unanswered, it is lost, and it does not come back.',
    learnMore: 'the-chat',
    derivedFrom: 'coach_reply',
  },

  // -------------------------------------------------------------------------- make it yours
  {
    key: 'programs',
    title: 'Open a program and change something',
    why: 'Your programs came across exactly as you wrote them, supersets and all. This is where you edit one.',
    tier: 'makeItYours',
    minutes: 8,
    href: '/coach/programs',
    cta: 'Open the program library',
    how: [
      'Library, then Training. Days run across the top; you edit one day at a time.',
      'Every movement shows your filmed demo. Tap it to check the clip is the right one.',
      'Drag a movement, or use the arrows, to reorder. Open a row for rest, weight, notes and supersets.',
      'Save Program. Anyone already on that plan sees the change on her next session.',
    ],
    watchOut:
      'Save Program rewrites the whole plan, including for clients part-way through it. It is not a draft. If you want to try something, save it as a template instead and assign that.',
    learnMore: 'writing-a-program',
    derivedFrom: null,
  },
  {
    key: 'coaching',
    title: 'Set how you coach',
    why: 'Check-in cadence, whether clients see exercise instructions, and when plan-expiry reminders reach you.',
    tier: 'makeItYours',
    minutes: 5,
    href: '/coach/settings/coaching',
    cta: 'Open coaching settings',
    how: [
      'Settings, then Coaching preferences.',
      'Check-in reminders follow your cadence, not a fixed week. Yours is fortnightly.',
      'Plan expiry reminders are off until you switch them on. With them off, nothing tells you a program is ending.',
    ],
    learnMore: 'coaching-settings',
    derivedFrom: 'coach_settings',
  },
  {
    key: 'knowledge',
    title: 'Teach the assistant how you coach',
    why: 'It answers clients in your voice using what you have taught it, and only what you have taught it.',
    tier: 'makeItYours',
    minutes: 10,
    href: '/coach/settings/knowledge',
    cta: 'Open the knowledge base',
    how: [
      'Assistant, then Knowledge. Add the things you find yourself typing over and over.',
      'Drop in a PDF, a screenshot or a doc and it reads it. Nothing is saved until you have read it back.',
      'The Method tab shows what it actually did with what you taught it, and what it still needs from you.',
    ],
    watchOut:
      'It will not invent an answer about a client it cannot see, and it will not give dietary advice it was not taught. An empty knowledge base means a very cautious assistant, not a confident wrong one.',
    learnMore: 'the-assistant',
    derivedFrom: 'knowledge',
  },
  {
    key: 'community',
    title: 'Post something to the group',
    why: 'A community nobody posts in is worse than no community. One post from you a week is what keeps it alive.',
    tier: 'makeItYours',
    minutes: 4,
    href: '/coach/community',
    cta: 'Open the community',
    how: [
      'Chat section, then Community. A broadcast from you appears at the top of everyone’s feed.',
      'Challenges sit beside it. A challenge scores itself off what members are already logging, so nobody has to enter anything twice.',
    ],
    learnMore: 'community-and-challenges',
    derivedFrom: null,
  },
];

export type StageState = OnboardingStage & {
  done: boolean;
  /** True when she ticked it rather than the data proving it. */
  selfReported: boolean;
};

export type CoachOnboarding = {
  stages: StageState[];
  dayOneDone: number;
  dayOneTotal: number;
  moreDone: number;
  moreTotal: number;
  readyToCoach: boolean;
  everythingDone: boolean;
  /** The next thing worth doing, or null when there is nothing left. */
  next: StageState | null;
};

/**
 * What is set up, worked out from real data wherever real data can prove it.
 *
 * PER COACH for the things a person learns, COMPANY-WIDE for the things a company owns. Assigning a
 * program is scoped to `created_by` so a new assistant coach cannot inherit Stephanie's tick and be
 * told she has already learned it; the knowledge base is company-wide because it genuinely is.
 */
export async function getCoachOnboarding(
  companyId: string,
  profileId: string,
): Promise<CoachOnboarding> {
  const svc = createServiceClient();

  /**
   * Written out one by one rather than through a helper, because every one of these is a place a
   * wrong table name or a missing column fails OPEN. The first draft of this file counted
   * `knowledge_entries` (the table is `coach_knowledge`) and selected `id` from `coach_settings`
   * (which has no id column). Both would have returned an error, been read as zero, and told
   * Stephanie forever that she had not taught the assistant anything after she had. Nothing would
   * have thrown, and no test would have caught it.
   *
   * Every query below was run against the live database before shipping.
   */
  const [contacts, assigned, replied, knowledge, settings, ticks] = await Promise.all([
    svc.from('contacts').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    // Scoped to THIS coach: her own first assignment, not the company's. A new assistant coach must
    // not inherit Stephanie's tick and be told she has already learned this.
    svc
      .from('plan_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('created_by', profileId),
    svc
      .from('client_messages')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_from_coach', true),
    svc.from('coach_knowledge').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    // coach_settings is one row per company and has no id column: company_id IS the key.
    svc
      .from('coach_settings')
      .select('company_id', { count: 'exact', head: true })
      .eq('company_id', companyId),
    svc.from('coach_checklist').select('step_key').eq('profile_id', profileId),
  ]);

  // Fail to NOT DONE in every case. A step that cannot be read should keep pointing at something
  // useful rather than quietly tick itself, which is the one direction that teaches nothing.
  const got = (r: { count: number | null; error: unknown }): boolean => !r.error && (r.count ?? 0) > 0;

  const derived: Record<string, boolean> = {
    contacts: got(contacts),
    plan_assignments: got(assigned),
    coach_reply: got(replied),
    knowledge: got(knowledge),
    coach_settings: got(settings),
  };

  const ticked = new Set(((ticks.data ?? []) as { step_key: string }[]).map((r) => r.step_key));

  const stages: StageState[] = ONBOARDING.map((s) => ({
    ...s,
    done: s.derivedFrom ? derived[s.derivedFrom] === true : ticked.has(s.key),
    selfReported: s.derivedFrom === null,
  }));

  const dayOne = stages.filter((s) => s.tier === 'dayOne');
  const more = stages.filter((s) => s.tier === 'makeItYours');
  const dayOneDone = dayOne.filter((s) => s.done).length;
  const moreDone = more.filter((s) => s.done).length;

  return {
    stages,
    dayOneDone,
    dayOneTotal: dayOne.length,
    moreDone,
    moreTotal: more.length,
    readyToCoach: dayOneDone === dayOne.length,
    everythingDone: dayOneDone === dayOne.length && moreDone === more.length,
    // Day one first, always. Nothing in the second tier matters while a woman is still waiting on
    // a plan that nobody has opened the queue to write.
    next: dayOne.find((s) => !s.done) ?? more.find((s) => !s.done) ?? null,
  };
}
