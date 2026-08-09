// Coach-console strings for the protocols surface, in one object.
//
// WHY NOT next-intl. Every other coach page reads next-intl keys out of messages/en.json and
// messages/es.json. This surface deliberately does not, YET, and the reason is mechanical: those two
// files are shared by every surface in the app, and this feature was built in parallel with other
// work touching them. Keeping the strings here means the feature ships without racing another change
// through the same two JSON files.
//
// The shape is the migration path, not a dead end: the keys below are already namespaced the way
// `app.coach.protocols.*` would be, so moving them is a copy of this object into messages/en.json,
// its translation into messages/es.json, and swapping `COACH_COPY.x` for `t('x')`.
//
// NOTE THE SPLIT. These are strings the COACH reads while operating the tool. Everything a MEMBER
// reads (the rules, the meals, the grocery list) is bilingual DATA in the protocol tables, not code,
// because it is Stephanie's copy and she owns it.

export const COACH_COPY = {
  eyebrow: 'Toolbox',
  title: 'Protocols',
  subtitle: 'The fixed onboarding template every new client starts on, before her personalised plan.',
  empty: 'No protocols yet.',
  emptyDetail: 'Nothing has been seeded for this company.',

  back: 'Back to protocols',
  durationDays: 'day protocol',
  mealsPerDay: 'meals a day',
  published: 'Live',
  unpublished: 'Not live',

  // Totals. Two figures, side by side, always. See src/lib/protocols/types.ts (StatedTotals).
  totalsTitle: 'Daily total',
  totalsStated: 'Her stated target',
  totalsSummed: 'The five meals sum to',
  totalsNote:
    'Both figures are shown because both are hers. The stated target is a deliberate round-up of the summed meals; nothing here rewrites it.',
  kcal: 'kcal',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',

  rulesTitle: 'The non-negotiables',
  rulesNote: 'In her order. The weighing convention comes first because it is the most error-prone part of any plan.',
  drinkNote: 'Before meal 1, on an empty stomach.',
  dayTitle: 'The day',
  dayNote: 'One fixed day, repeated for the whole protocol. Consistency is the deliverable.',
  groceryTitle: 'The grocery list',
  groceryNote: 'Quantities for the full protocol, so there are no decisions at the shop either.',

  // Spanish gate
  langEnglish: 'English',
  langSpanish: 'Español',
  esMissingTitle: 'No Spanish version',
  esMissingBody: 'Half of her audience is Spanish-first and this is day one of their experience.',
  esDraftTitle: 'Spanish is a draft',
  esDraftBody:
    'Translated faithfully but not signed off. It is her copy and her voice, so it is not served to Spanish-speaking members until she approves it.',
  esApproveCta: 'Stephanie approved this Spanish',
  esUnapproveCta: 'Send the Spanish back to draft',
  esApprovedTitle: 'Spanish approved',
  esApprovedBody: 'Spanish-speaking members can be sent this protocol.',

  // Assign
  assignTitle: 'Send this protocol',
  assignClient: 'Client',
  assignLanguage: 'Language',
  assignSentOn: 'Sent on',
  assignEnds: 'Ends',
  assignPlanDue: 'Personalised plan due',
  assignCta: 'Send protocol',
  assignBusy: 'Sending',
  assignNoClients: 'No clients to send to yet.',
  assignErrorDuplicate: 'That client is already on this protocol.',
  assignErrorNoSpanish: 'The Spanish version is not approved yet, so it cannot be sent in Spanish.',
  assignErrorFailed: 'Could not send it. Try again.',

  // Roster
  rosterTitle: 'Who is on it',
  rosterEmpty: 'Nobody has been sent this protocol yet.',
  colClient: 'Client',
  colSent: 'Sent',
  colEnds: 'Ends',
  colLeft: 'Days left',
  colPlan: 'Personalised plan',
  colStatus: 'Status',
  statusActive: 'On protocol',
  statusCompleted: 'Completed',
  statusCancelled: 'Cancelled',
  planDelivered: 'Delivered',
  planDue: 'DUE',
  planPending: 'Not yet',
  markComplete: 'Mark complete',
  markCancelled: 'Cancel',
  markPlanDelivered: 'Plan delivered',
  undoPlanDelivered: 'Undo',
  endedToday: 'Ends today',
  ended: 'Ended',

  // The overdue callout: the failure this table exists to prevent.
  dueTitle: 'Personalised plans due',
  dueBody: 'These clients finished the protocol. Step two is theirs now.',
  dueNone: 'Nothing overdue.',
} as const;

export type CoachCopyKey = keyof typeof COACH_COPY;
