// PII detection + redaction for support tickets. PURE: no DB, no network, no `@/` imports, so it is
// unit-testable on its own (see .qa-visual/support-pii-test.mjs).
//
// WHY THIS EXISTS. A member describing a problem will paste whatever is in front of them, including
// a government ID, a date of birth, or a card number. That text then fans out to places with weaker
// controls than the database it came from: a Telegram chat, a GitHub issue, an email. Telegram in
// particular is a third-party server, a phone lock screen, and anyone later added to the group.
//
// So the rule this module enforces is: THE RAW BODY NEVER LEAVES THE APP. Notifications carry the
// generated summary plus a flag; the untouched original stays in the database behind an operator
// login and a visible warning. Redaction here is the belt for the places that must carry some body
// text at all.
//
// Detection is deliberately GREEDY. A false positive costs one redacted string in a Telegram message
// that already links to the full ticket. A false negative puts someone's social security number in a
// group chat forever. Those are not comparable, so every ambiguous case resolves toward redacting.

export type PiiKind = 'ssn' | 'card' | 'dob' | 'passport' | 'bank';

export type PiiScan = {
  /** True when anything sensitive was found. Drives the notification banner and the ticket flag. */
  flagged: boolean;
  /** Which categories matched, deduped, stable order. Never includes the matched VALUES. */
  kinds: PiiKind[];
  /** The text with every match replaced by a labelled token. Safe(r) to forward. */
  redacted: string;
};

/** Luhn check, so a 16-digit order number is not reported as a credit card. */
function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// Ordered: card before SSN, because a 9-digit run inside a card number must not be eaten by the SSN
// rule first and leave the rest of the card in the clear.
const RULES: { kind: PiiKind; re: RegExp; verify?: (m: string) => boolean }[] = [
  {
    kind: 'card',
    // 13-19 digits, optionally split by spaces or dashes in groups.
    re: /\b(?:\d[ -]?){12,18}\d\b/g,
    verify: (m) => {
      const d = m.replace(/\D/g, '');
      return d.length >= 13 && d.length <= 19 && luhnValid(d);
    },
  },
  {
    kind: 'ssn',
    // 123-45-6789, 123 45 6789, or a bare 9-digit run. The bare form is why this is greedy: it also
    // matches some order numbers, and that trade is made on purpose.
    re: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,
  },
  {
    kind: 'passport',
    // One letter + 8 digits, the common US format. Requires the letter so it cannot eat a phone.
    re: /\b[A-Z]\d{8}\b/g,
  },
  {
    kind: 'bank',
    // A routing/account pair is usually written together; catch long bare digit runs that are not
    // cards (cards are consumed above) and not obviously years.
    re: /\b\d{9,17}\b/g,
  },
  {
    kind: 'dob',
    // 5/11/2000, 05-11-2000, 2000-05-11. Any full date is treated as potentially a date of birth:
    // deciding whether "3/4/2024" is a birthday or an appointment needs context this cannot see.
    re: /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b/g,
  },
];

const LABEL: Record<PiiKind, string> = {
  ssn: '[SSN REDACTED]',
  card: '[CARD REDACTED]',
  dob: '[DOB REDACTED]',
  passport: '[ID REDACTED]',
  bank: '[ACCOUNT REDACTED]',
};

/**
 * Scan text for sensitive values. Returns the redacted copy and WHICH kinds matched, never the
 * matched values themselves, so the result is safe to log and safe to store on the ticket row.
 */
export function scanForPii(input: string | null | undefined): PiiScan {
  const text = typeof input === 'string' ? input : '';
  if (!text.trim()) return { flagged: false, kinds: [], redacted: text };

  const kinds: PiiKind[] = [];
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.re, (match) => {
      if (rule.verify && !rule.verify(match)) return match;
      if (!kinds.includes(rule.kind)) kinds.push(rule.kind);
      return LABEL[rule.kind];
    });
  }
  return { flagged: kinds.length > 0, kinds, redacted: out };
}

/**
 * What a notification is allowed to say about a ticket body.
 *
 * Returns the REDACTED text, hard-truncated. Callers must never substitute the raw body "because it
 * reads better": the whole point is that the chat transcript cannot become a copy of the database.
 */
export function notificationSafeBody(input: string | null | undefined, maxLen = 400): string {
  const { redacted } = scanForPii(input);
  const clean = redacted.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length <= maxLen ? clean : `${clean.slice(0, maxLen - 1)}…`;
}
