// Objectionable-content filter for member-authored community text.
//
// App Store guideline 1.2 requires "a method for filtering objectionable material" alongside
// reporting, blocking, and published contact info. This is that method. It runs BEFORE a post or
// comment is written, so filtered content never reaches the feed at all.
//
// Deliberately NOT a profanity blocklist. Stephanie's audience talks like adults about hard things,
// and auto-rejecting someone for swearing in a post about their body would do more harm than the
// swearing does. What actually needs stopping is: targeted abuse, self-harm content that needs a
// human rather than a delete, sexual content, and spam. So the filter has two tiers:
//
//   block  -> refuse the write and tell the author why (slurs, explicit sexual content, spam links)
//   flag   -> ACCEPT the write, then raise a moderation report automatically so a human sees it fast
//             (self-harm language). Silently deleting a member's cry for help is the wrong response;
//             getting a coach to it quickly is the right one.
//
// Pure and dependency-free so it can be unit-tested and reused by any surface (posts, comments, and
// later DMs). Bilingual EN + ES because the community is.

export type FilterVerdict =
  | { action: 'allow' }
  | { action: 'block'; reason: 'slur' | 'sexual' | 'spam' }
  | { action: 'flag'; reason: 'self_harm' };

// Normalize the leetspeak/spacing tricks used to slip a word past a naive substring match:
// "f.u.c.k", "b i t c h", "sh1t". Collapses to lowercase alpha with single spaces.
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents so "ñ"/"n" and "é"/"e" compare equal
    .replace(/[013457$@!|]/g, (c) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', $: 's', '@': 'a', '!': 'i', '|': 'i' })[c] ?? c)
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Also collapse ALL whitespace so "b i t c h" matches "bitch".
function despaced(normalized: string): string {
  return normalized.replace(/\s/g, '');
}

// Slurs and explicit sexual terms are the block tier. Kept short and unambiguous on purpose: every
// entry here is a word with no innocent use in a fitness community. A long list produces false
// positives, and a false positive on a member's honest post is a worse outcome than a missed swear.
const SLURS = ['faggot', 'nigger', 'tranny', 'retard', 'kike', 'spic', 'wetback', 'chink'];
const SEXUAL = ['porn', 'xxx', 'blowjob', 'cumshot', 'onlyfans', 'nudes'];

// Self-harm: FLAG, never block. EN + ES.
const SELF_HARM = [
  'kill myself',
  'killing myself',
  'end my life',
  'want to die',
  'suicide',
  'suicidal',
  'self harm',
  'cut myself',
  'starve myself',
  'quiero morir',
  'matarme',
  'suicidarme',
  'quitarme la vida',
  'hacerme dano',
];

// Spam: the shape, not the words. A member linking one article is fine; three links plus a promo
// verb is a bot. Checked against the RAW text since URLs are stripped by normalize().
const SPAM_HOSTS = /\b(?:bit\.ly|tinyurl|t\.me|wa\.me|whatsapp\.com\/(?:chat|send)|cash\.app|venmo\.com)\b/i;
const PROMO = /\b(?:buy now|click here|make money|crypto|forex|investment opportunity|dm me to earn|gana dinero|invierte ahora)\b/i;

function countUrls(text: string): number {
  return (text.match(/https?:\/\/|www\./gi) ?? []).length;
}

/**
 * Classify member-authored text. Returns the strictest verdict that applies.
 * `allow` means write it; `block` means refuse; `flag` means write it AND raise a report.
 */
export function classifyContent(raw: string): FilterVerdict {
  const text = (raw ?? '').trim();
  if (!text) return { action: 'allow' };

  const norm = normalize(text);
  const tight = despaced(norm);

  for (const term of SLURS) {
    if (tight.includes(despaced(term))) return { action: 'block', reason: 'slur' };
  }
  for (const term of SEXUAL) {
    if (tight.includes(despaced(term))) return { action: 'block', reason: 'sexual' };
  }

  // Spam: a known link-shortener/payment host, OR promo language, OR link-stuffing.
  if (SPAM_HOSTS.test(text)) return { action: 'block', reason: 'spam' };
  if (PROMO.test(text) && countUrls(text) >= 1) return { action: 'block', reason: 'spam' };
  if (countUrls(text) >= 3) return { action: 'block', reason: 'spam' };

  // Self-harm last: it never blocks, so it must not shadow a genuine block above.
  for (const phrase of SELF_HARM) {
    if (norm.includes(normalize(phrase))) return { action: 'flag', reason: 'self_harm' };
  }

  return { action: 'allow' };
}

/** i18n key for the member-facing refusal, so the UI can localize EN/ES. */
export function blockMessageKey(reason: 'slur' | 'sexual' | 'spam'): string {
  return `filter_${reason}`;
}
