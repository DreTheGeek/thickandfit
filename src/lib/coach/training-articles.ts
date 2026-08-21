/**
 * The written manual for the coaching console.
 *
 * WHY IT IS DATA AND NOT PAGES. One article has to be readable on the Training screen, findable in
 * the command palette, and linkable from the screen it describes. Written as MDX or as pages, that
 * text lives in three places and drifts; two of the three go stale and nobody notices, because
 * nothing fails when documentation is wrong.
 *
 * Each article carries the `route` it teaches, so "how do I assign a program" can put her ON the
 * queue rather than only telling her where it is.
 *
 * ON LANGUAGE: English only, deliberately, for the same reason as lib/coach/onboarding.ts. The
 * coach console has four users and they all work in English. The MEMBER app is the bilingual
 * surface and every string a member can see is in both catalogs.
 *
 * THE RULE FOR WRITING ONE. Say what the thing is FOR before saying where it is. A sentence that
 * only renames the button ("Click Assign to assign a program") is worse than nothing: it costs a
 * read and teaches nothing. Every `gotchas` entry must be something that actually caught somebody.
 */

export type TrainingStep = { title: string; body: string };

export type TrainingCategory =
  | 'Getting started'
  | 'Every day'
  | 'Programming'
  | 'Nutrition'
  | 'The assistant'
  | 'Setup';

export const TRAINING_CATEGORIES: TrainingCategory[] = [
  'Getting started',
  'Every day',
  'Programming',
  'Nutrition',
  'The assistant',
  'Setup',
];

export type TrainingArticle = {
  slug: string;
  title: string;
  /** One line. This is what shows in search results. */
  summary: string;
  category: TrainingCategory;
  /** The screen this teaches, so search can route straight there. */
  route?: string;
  /** Extra words people actually type. Search matches on these too. */
  keywords: string[];
  minutes: number;
  intro: string;
  steps: TrainingStep[];
  /** Things that trip people up, written plainly. */
  gotchas?: string[];
};

export const TRAINING: TrainingArticle[] = [
  // ------------------------------------------------------------------ getting started
  {
    slug: 'first-day',
    title: 'Your first day',
    summary: 'The four things worth doing before you coach anybody through this.',
    category: 'Getting started',
    route: '/coach/getting-started',
    keywords: ['setup', 'start', 'new', 'onboarding', 'begin', 'first time', 'lost'],
    minutes: 8,
    intro:
      'Nothing here is empty. Your 41 programs, 279 clients, 366 filmed demos and eleven thousand '
      + 'messages came across from Lenus, so this is not a blank app you have to fill in. It is your '
      + 'work, in a place you own, and the first day is about finding where each part landed.',
    steps: [
      {
        title: 'Open one client',
        body:
          'People in the sidebar. Search a name you know and open her. Weight, check-ins, photos, '
          + 'every message: one page. If you understand this page you understand most of the console, '
          + 'because everything else feeds it.',
      },
      {
        title: 'Read the Needs you queue',
        body:
          'Four lists of women waiting on something. This is the screen to open with your coffee. '
          + 'Anything with a number beside it is a person, not a metric.',
      },
      {
        title: 'Assign one program',
        body:
          'From Awaiting a plan, open somebody and pick a program. It reaches her Today screen '
          + 'immediately, with your demo playing on every movement. Thirty seconds once you know where it is.',
      },
      {
        title: 'Answer one message',
        body:
          'Chat in the sidebar. Her recent workouts and last check-in sit beside the thread, so you '
          + 'are not guessing who she is while you type.',
      },
    ],
    gotchas: [
      'Nothing you do in here messages a client unless you send it or switch it on. Looking around is safe.',
      'The queues count real people. A 3 beside "Awaiting a plan" is three women who paid and are waiting.',
    ],
  },
  {
    slug: 'client-record',
    title: 'A client record, top to bottom',
    summary: 'What the software remembers about a woman, and where each part came from.',
    category: 'Getting started',
    route: '/coach/clients',
    keywords: ['client', 'member', 'profile', 'record', 'history', 'lenus', 'contact'],
    minutes: 6,
    intro:
      'Two words that look interchangeable and are not. A CLIENT is a record: the contact that came '
      + 'across from Lenus, with her history. A MEMBER is an app account: somebody who can log in, log '
      + 'food and open a workout. Most of your people are both. Some are only one.',
    steps: [
      {
        title: 'Clients',
        body:
          'Everyone in your records, including the 279 who migrated. Her weight history, check-ins, '
          + 'photos and message archive are here whether or not she has ever opened the app.',
      },
      {
        title: 'Members',
        body:
          'App accounts. If she is here she can log in. If she is a Client and not a Member she has '
          + 'not claimed her login yet, and cannot log anything, so none of the activity queues can see her.',
      },
      {
        title: 'Leads',
        body: 'People who gave you their details and have not paid. The waitlist and the funnel feed this.',
      },
      {
        title: 'Coach and access',
        body:
          'At the bottom of a client record. Assign her to a specific coach, or pause her. A pause is '
          + 'read-only: she keeps her records and her history, the paid surface closes, and she lands on '
          + 'a page explaining what she still has rather than a paywall.',
      },
    ],
    gotchas: [
      'A migrated client with no app account cannot appear in Gone quiet. She has never been active, so "quiet" would put 250 women who have never opened the app at the top of a churn queue on day one.',
      'Pausing does not touch her card. Some pauses are unpaid breaks and some are paid holds, and the software cannot tell which you meant.',
    ],
  },

  // ----------------------------------------------------------------------- every day
  {
    slug: 'needs-you',
    title: 'The Needs you queue',
    summary: 'Four lists, one question: who is waiting on me today.',
    category: 'Every day',
    route: '/coach/awaiting',
    keywords: ['queue', 'awaiting', 'quiet', 'intake', 'renewals', 'waiting', 'churn', 'today'],
    minutes: 7,
    intro:
      'These were four separate screens down the sidebar and they are the same woman at four points '
      + 'in her life with you. Left to right is roughly the order she hits them.',
    steps: [
      {
        title: 'Awaiting a plan',
        body:
          'She paid and has no program. The app told her you write these by hand and will message her '
          + 'when it is ready, so this queue is the thing that keeps that sentence true. Anything past '
          + 'three days is flagged as overdue, which is the software admitting the promise slips.',
      },
      {
        title: 'Intake to review',
        body:
          'She wrote something at signup that deserves a human read: an injury, a pregnancy, a '
          + 'medication, chest pain, a surgery. The extractor deliberately over-flags, and that bias is '
          + 'only defensible because somebody reads this. A flag nobody looks at is worse than no flag, '
          + 'because it creates the belief that someone is checking.',
      },
      {
        title: 'Gone quiet',
        body:
          'She stopped logging. Seven, fourteen, twenty-eight days, worked out from workouts, food, '
          + 'weight, habits, check-ins and her own messages. This is EARLIER than a declined card: by '
          + 'the time billing notices, she decided weeks ago.',
      },
      {
        title: 'Plans running out',
        body:
          'Her twelve weeks are nearly up. Expired sits at the top, because a queue that hides a lapsed '
          + 'plan hides the exact case that went wrong.',
      },
    ],
    gotchas: [
      'She gets an automatic message at 7, 14 and 28 quiet days. The 28-day one says a coach is going to reach out personally. That is only true if somebody works this queue.',
      '"At risk" means two different things in this app and both are real. Billing risk is a declined card. Engagement risk is her going quiet. Both chips can be lit at once and they are usually different women.',
    ],
  },
  {
    slug: 'the-chat',
    title: 'The chat',
    summary: 'Where she tells you the plan is too hard, before she quietly stops doing it.',
    category: 'Every day',
    route: '/coach/inbox',
    keywords: ['chat', 'inbox', 'message', 'reply', 'dm', 'talk'],
    minutes: 4,
    intro:
      'The thing she is really paying for. Everything else is infrastructure around this conversation.',
    steps: [
      {
        title: 'Unanswered first',
        body: 'The list orders by who is waiting on you, not by who wrote last.',
      },
      {
        title: 'Her context is right there',
        body:
          'Recent workouts, current weight, last check-in, beside the thread. You are not opening three '
          + 'tabs to remember who she is.',
      },
      {
        title: 'It lands in her app',
        body:
          'Not an email. She gets a push if she has allowed them, and the message is in her inbox when '
          + 'she opens the app either way.',
      },
    ],
    gotchas: [
      'Your home screen counts unanswered messages over fourteen days. Older than that is not unanswered, it is lost, and it stops being counted because it has stopped being recoverable.',
      'Her welcome message from you is written by the app at signup and depends on what she bought. A training-only member is never told to log her food, because nobody is reading it for her.',
    ],
  },

  // ---------------------------------------------------------------------- programming
  {
    slug: 'assigning-a-program',
    title: 'Assigning a program',
    summary: 'The most valuable thirty seconds in the console.',
    category: 'Programming',
    route: '/coach/awaiting',
    keywords: ['assign', 'plan', 'program', 'give', 'start', 'training plan'],
    minutes: 4,
    intro:
      'A woman who has paid and has no plan cannot use this app for the thing she bought it for. '
      + 'Everything on her Today screen reads zero until this happens.',
    steps: [
      {
        title: 'Open her from Awaiting a plan',
        body: 'Or from her client record. Both routes end in the same place.',
      },
      {
        title: 'Pick from your library',
        body:
          'All 41 of your programs, with how many days each runs and how many of its movements have '
          + 'your footage. The @HOME ones need no gym, which matters for somebody who has not joined one yet.',
      },
      {
        title: 'Assign',
        body:
          'She sees it immediately. Her first workout, her demos, her rest timers, all of it live on '
          + 'her phone before she has closed the app.',
      },
    ],
    gotchas: [
      'Running a client through a block she has done before UPDATES her existing assignment rather than adding a second one, and moves her start date to today. That is what you want, but the date moving can surprise you.',
      'She only ever sees her newest assignment as "your program". The older ones stay in her history.',
    ],
  },
  {
    slug: 'writing-a-program',
    title: 'Editing a program',
    summary: 'Reordering, supersets, timed movements, and the one thing to be careful about.',
    category: 'Programming',
    route: '/coach/programs',
    keywords: ['program', 'builder', 'edit', 'superset', 'reorder', 'drag', 'sets', 'reps', 'rest'],
    minutes: 9,
    intro:
      'Your programs came across exactly as you wrote them, supersets and rep ranges and per-movement '
      + 'notes included. The builder is for changing them, and it now shows all of that rather than a '
      + 'sets box and a reps box.',
    steps: [
      {
        title: 'One day at a time',
        body:
          'Days run across the top with a movement count under each. You edit the one you are looking '
          + 'at, so a 22-movement leg day is not sitting beside a 24-movement upper body day.',
      },
      {
        title: 'Every movement shows your demo',
        body: 'Tap the thumbnail to play it full size and check it is the right clip.',
      },
      {
        title: 'Reorder',
        body:
          'Drag a row, or use the up and down arrows. The arrows work on a phone; dragging does not, '
          + 'which is why both are there.',
      },
      {
        title: 'Open a row for the rest of it',
        body:
          'Rest, target weight, AMRAP, and your note for that movement. The note is what a member reads '
          + 'before she starts: incline settings, cues, what she should feel.',
      },
      {
        title: 'Supersets',
        body:
          'One button on a row: superset it with the one above, or break the group. A member performing '
          + 'a superset is told she goes straight into the next movement with no rest, which is a '
          + 'different session from the same movements as straight sets.',
      },
      {
        title: 'Timed movements',
        body:
          'A movement you wrote as a duration gets a minutes box, not sets and reps. A 25-minute incline '
          + 'walk is not ten reps at zero pounds, and the member sees a clock rather than a rep counter.',
      },
    ],
    gotchas: [
      'SAVE PROGRAM rewrites the whole plan, including for clients part-way through it. It is not a draft. To try something, use Save as template and assign the template instead.',
      'The header says "Unsaved changes" the moment you touch anything, and the browser warns you before you close the tab.',
    ],
  },
  {
    slug: 'the-exercise-library',
    title: 'The exercise library',
    summary: 'Your 366 filmed demos, the 940 catalog movements, and which is which.',
    category: 'Programming',
    route: '/coach/exercises',
    keywords: ['exercise', 'library', 'demo', 'video', 'movement', 'filmed', 'spanish'],
    minutes: 5,
    intro:
      'Two kinds of movement live here. The ones you filmed, and a seeded catalog that fills the gaps '
      + 'so a program can reference something you have not shot yet.',
    steps: [
      {
        title: 'Yours',
        body:
          '366 movements with your footage. These are the reason this is an app and not a spreadsheet, '
          + 'and they play on every screen a member touches.',
      },
      {
        title: 'The catalog',
        body:
          'About 940 more, unfilmed. A member sees an icon instead of a video, which is honest: it means '
          + '"not filmed", not "broken".',
      },
      {
        title: 'Spanish',
        body:
          'The third tab. Movements without a Spanish name, so a Spanish-speaking member is not reading '
          + 'English in the middle of her workout.',
      },
    ],
    gotchas: [
      'Archiving a movement does not remove it from programs that already use it. Curation must not erase history.',
    ],
  },

  // ------------------------------------------------------------------------ nutrition
  {
    slug: 'meal-plans',
    title: 'Meal plans and recipes',
    summary: 'The three nutrition libraries, and who gets a plan.',
    category: 'Nutrition',
    route: '/coach/tool/meal-plans',
    keywords: ['meal', 'plan', 'recipe', 'book', 'food', 'nutrition', 'macros'],
    minutes: 6,
    intro:
      'Three libraries that used to be three sidebar rows and are now three tabs, because they are one '
      + 'job: what she eats.',
    steps: [
      {
        title: 'Meal plans',
        body: 'Per-client plans, including the ones imported from Lenus. Five calorie slots, raw grams, free-veg note.',
      },
      { title: 'Recipes', body: 'The searchable library. Filter by macros, meal, or the book it came from.' },
      { title: 'Recipe books', body: 'Collections. A cover card that opens the recipe browser filtered to that book.' },
    ],
    gotchas: [
      'A custom meal plan is part of the higher tier only. A training-only member is never promised one, anywhere in the app, because promising a service she did not buy is a refund conversation rather than a copy mistake.',
    ],
  },

  // -------------------------------------------------------------------- the assistant
  {
    slug: 'the-assistant',
    title: 'The assistant',
    summary: 'What it knows, where it learned it, and what it refuses to do.',
    category: 'The assistant',
    route: '/coach/method',
    keywords: ['assistant', 'ai', 'knowledge', 'method', 'coach chat', 'answers'],
    minutes: 8,
    intro:
      'It answers members in your voice using what you have taught it, and only what you have taught '
      + 'it. It is not a general chatbot with your name on it.',
    steps: [
      {
        title: 'Knowledge is what you teach it',
        body:
          'The things you find yourself typing over and over. Drop in a PDF, a screenshot or a doc and '
          + 'it reads them. Nothing is saved until you have read it back and approved it.',
      },
      {
        title: 'Method is what it did',
        body:
          'What it answered, what it got asked that it could not answer, and what it still needs from '
          + 'you. Needs-you first: an unanswerable question is a gap in the knowledge base, not a failure.',
      },
      {
        title: 'Approvals',
        body:
          'Anything it drafts on your behalf waits for a human. Nothing reaches a member with your name '
          + 'on it that you have not seen.',
      },
    ],
    gotchas: [
      'It will not invent an answer about a client whose data it cannot see, and it will not give dietary advice it was not taught. An empty knowledge base gives you a very cautious assistant, not a confident wrong one.',
      'It never says the word "AI" to a member. It is your method, in your voice.',
    ],
  },

  // ----------------------------------------------------------------------------- setup
  {
    slug: 'coaching-settings',
    title: 'Coaching preferences',
    summary: 'Check-in cadence, what clients see, and the reminder that is off by default.',
    category: 'Setup',
    route: '/coach/settings/coaching',
    keywords: ['settings', 'preferences', 'check-in', 'cadence', 'reminders', 'expiry'],
    minutes: 5,
    intro: 'The handful of switches that change how the app behaves for every one of your clients.',
    steps: [
      {
        title: 'Check-in cadence',
        body: 'Reminders follow the cadence you set, not a fixed week. Yours is fortnightly.',
      },
      {
        title: 'Exercise instructions',
        body:
          'Whether clients see the coaching cues on each movement. Turn it off and they are dropped at '
          + 'the boundary, not just hidden, so they are not sitting in the page for anyone who looks.',
      },
      {
        title: 'Plan expiry reminders',
        body:
          'Off until you switch them on. With them off, nothing tells you a program is ending except '
          + 'the Plans running out queue.',
      },
    ],
  },
  {
    slug: 'coverage-and-campaigns',
    title: 'Coverage and campaigns',
    summary: 'The two things you set before a date and then stop thinking about.',
    category: 'Setup',
    route: '/coach/coverage',
    keywords: ['coverage', 'holiday', 'away', 'campaign', 'season', 'christmas', 'rota'],
    minutes: 5,
    intro:
      'Neither of these is a queue. Nothing accumulates in them. They are both "decide now so it '
      + 'happens later without you".',
    steps: [
      {
        title: 'Coverage',
        body:
          'Who is covering while you are away. The dates are inclusive: "back on the 20th" is stored as '
          + 'away until the 19th. Members see who is covering rather than silence.',
      },
      {
        title: 'Campaigns',
        body:
          'A message to a whole cohort on a date range that recurs every year. It ships empty on '
          + 'purpose: pre-writing a "December save" would mean guessing your offers, your voice and your '
          + 'numbers.',
      },
    ],
    gotchas: [
      'A campaign carries a tenure floor, default fourteen days, so a woman who joined on 20 December is not told on the 26th not to give up.',
      'A season that crosses New Year works, and is the reason the date handling is not the obvious version.',
    ],
  },
];

export function trainingSearchText(a: TrainingArticle): string {
  return [a.title, a.summary, a.category, ...a.keywords].join(' ').toLowerCase();
}

export function trainingBySlug(slug: string): TrainingArticle | undefined {
  return TRAINING.find((a) => a.slug === slug);
}
