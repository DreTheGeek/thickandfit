// Support-ticket PII detection. Imports the REAL module (Node strips the TS types).
//
// Asymmetry that drives every case below: a false positive costs one redacted string in a Telegram
// message that already links to the full ticket. A false negative puts a social security number in a
// group chat forever. So the suite asserts detection aggressively and only protects the specific
// non-sensitive values the product genuinely needs to survive (ticket ids, amounts, times).
import { scanForPii, notificationSafeBody } from '../src/lib/support/pii.ts';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

// --- the real reported ticket, verbatim from the reference screenshot -----------------------------
const REAL =
  'My client is trying to login. Their SSN is 238-99-2177 and their DOB is 5/11/2000 and it wont ' +
  'allow them to update it. They cant login and upload their IDs and things like that. They also ' +
  'can not add their payment card on file. They are getting a 404 error';
const real = scanForPii(REAL);
ok('real ticket flagged', real.flagged === true);
ok('real ticket: SSN gone', !real.redacted.includes('238-99-2177'));
ok('real ticket: DOB gone', !real.redacted.includes('5/11/2000'));
ok('real ticket: kinds reported', real.kinds.includes('ssn') && real.kinds.includes('dob'));
// The surrounding problem description must survive, or the ticket becomes unworkable.
ok('real ticket: 404 kept', real.redacted.includes('404 error'));
ok('real ticket: intent kept', real.redacted.includes('trying to login'));
// The scan result itself is stored + logged, so it must never carry the raw values.
ok('kinds never leak values', !JSON.stringify(real.kinds).includes('238'));

// --- SSN forms ------------------------------------------------------------------------------------
ok('ssn dashed', scanForPii('ssn 123-45-6789').flagged === true);
ok('ssn spaced', scanForPii('ssn 123 45 6789').flagged === true);
ok('ssn bare', scanForPii('ssn 123456789').flagged === true);

// --- cards: Luhn-verified so an order number is not a card ---------------------------------------
const card = scanForPii('card 4242 4242 4242 4242');
ok('valid card flagged', card.flagged === true && card.kinds.includes('card'));
ok('card digits gone', !card.redacted.includes('4242 4242'));
// Fails Luhn -> not reported as a card. It may still trip the greedy bank rule, which is acceptable;
// what matters is that it is NOT mislabeled as a payment card.
ok('luhn-invalid not a card', !scanForPii('ref 1234 5678 9012 3456').kinds.includes('card'));

// --- dates of birth --------------------------------------------------------------------------------
ok('dob slashes', scanForPii('dob 5/11/2000').flagged === true);
ok('dob dashes', scanForPii('born 05-11-2000').flagged === true);
ok('dob iso', scanForPii('dob 2000-05-11').flagged === true);

// --- what must NOT be flagged, or the product breaks ----------------------------------------------
ok('plain complaint clean', scanForPii('I cannot log in and the page is blank').flagged === false);
ok('empty clean', scanForPii('').flagged === false);
ok('null safe', scanForPii(null).flagged === false);
ok('undefined safe', scanForPii(undefined).flagged === false);
ok('ticket id clean', scanForPii('ticket TKT-00000006 is broken').flagged === false);
ok('error code clean', scanForPii('getting a 404 error on checkout').flagged === false);
ok('price clean', scanForPii('charged me $19.97 twice').flagged === false);
ok('time clean', scanForPii('happened at 3:42 PM today').flagged === false);
ok('email not flagged', scanForPii('reach me at dre@kaldrbusiness.com').flagged === false);
ok('short numbers clean', scanForPii('my order was 4821').flagged === false);

// --- redaction is labelled, so an operator can see WHAT was removed --------------------------------
ok('ssn labelled', scanForPii('ssn 123-45-6789').redacted.includes('[SSN REDACTED]'));
ok('card labelled', card.redacted.includes('[CARD REDACTED]'));
ok('dob labelled', scanForPii('dob 5/11/2000').redacted.includes('[DOB REDACTED]'));

// --- ordering: a card must not be half-eaten by the SSN rule ---------------------------------------
const combo = scanForPii('card 4242424242424242 ssn 123-45-6789');
ok('card+ssn both caught', combo.kinds.includes('card') && combo.kinds.includes('ssn'));
ok('no raw card fragment', !/4242424242/.test(combo.redacted));

// --- notificationSafeBody: the function notifications must use -------------------------------------
const safe = notificationSafeBody(REAL);
ok('notif body redacted', !safe.includes('238-99-2177') && !safe.includes('5/11/2000'));
ok('notif body readable', safe.includes('404 error'));
ok('notif body single line', !safe.includes('\n'));
const long = notificationSafeBody('x'.repeat(900), 100);
ok('notif body truncated', long.length <= 100);
ok('notif truncation marked', long.endsWith('…'));
ok('notif empty safe', notificationSafeBody(null) === '');

console.log(`support pii: ${pass}/${pass + fails.length} passed`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
