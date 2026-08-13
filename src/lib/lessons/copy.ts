// Coach-console strings for the lessons surface, in one object.
//
// Same reasoning as src/lib/protocols/copy.ts, and the same migration path: these keys are already
// namespaced the way `app.coach.lessons.*` would be, so moving them is a copy into messages/en.json,
// a translation into messages/es.json, and swapping COACH_COPY.x for t('x').
//
// NOTE THE SPLIT. These are strings the COACH reads while working the tool. Everything a MEMBER
// would read is bilingual DATA in the lessons tables, because it is her copy and she owns it.

export const COACH_COPY = {
  eyebrow: 'Toolbox',
  title: 'Lessons',
  subtitle:
    'The teaching you send clients: a video, a guide, or both. Recovered from Lenus with every send on record.',
  empty: 'No lessons yet.',
  emptyDetail: 'Nothing has been imported for this company.',

  back: 'Back to lessons',
  uncategorised: 'Uncategorised',

  video: 'video',
  videos: 'videos',
  document: 'guide',
  documents: 'guides',

  // Deliberately past tense. These counts are the Lenus history, not something this app will do.
  sentToOne: 'Sent to 1 client',
  sentToMany: 'Sent to {n} clients',
  neverSent: 'Not sent to anyone yet',

  live: 'Live to members',
  notLive: 'Coach only',
  notLiveNote:
    'Imported lessons stay coach-only until you have looked at them here. Nothing has reached a member.',

  inSequence: 'Part of',
  noAssets: 'No files on this lesson.',
  assetMissing: 'File is missing from storage.',
  download: 'Download',
  watch: 'Watch',

  esMissing: 'No Spanish',
  esDraft: 'Spanish draft, not approved',
  esApproved: 'Spanish approved',
  esNote:
    'Spanish is not served to members until you approve it. A draft translation is not your voice.',

  sequencesTitle: 'Sequences',
  sequencesNote: 'The drip orders you built on Lenus, with the lessons each one sends.',
} as const;
