// Telegram ticket alert formatting. Imports the REAL module's pure exports (Node strips TS types).
//
// The assertion that matters most is the LAST section: the message must be incapable of carrying the
// raw reported text. Everything else is cosmetics; that one is the security property.
import { buildTicketMessage, formatTicketNumber } from '../src/lib/support/telegram-format.ts';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

// --- ticket numbering -----------------------------------------------------------------------------
ok('pads to 8', formatTicketNumber(6) === 'TKT-00000006');
ok('handles large', formatTicketNumber(12345678) === 'TKT-12345678');
ok('handles 1', formatTicketNumber(1) === 'TKT-00000001');
ok('null safe', formatTicketNumber(null) === 'TKT-00000000');
ok('zero safe', formatTicketNumber(0) === 'TKT-00000000');

const base = {
  id: 'd47dfda1-95f4-4f39-ad27-4325c36e7244',
  ticketNumber: 6,
  repName: 'Big Sean',
  companyName: 'Post Grad',
  category: 'Client Portal Issue',
  email: 'bigseansteele@derrickharper.com',
  summary: 'The tenant reports that a client cannot log in or add a payment card due to a 404 error.',
  piiFlagged: true,
  hasAttachment: true,
  videoUrl: 'https://loom.com/share/abc123',
};

const msg = buildTicketMessage(base);

// --- the fields the reference format carries -------------------------------------------------------
ok('has ticket number', msg.includes('TKT-00000006'));
ok('names the reporter', msg.includes('Big Sean from Post Grad'));
ok('has category', msg.includes('Client Portal Issue'));
ok('has POC email', msg.includes('bigseansteele@derrickharper.com'));
ok('has summary', msg.includes('404 error'));
ok('links the ticket', msg.includes('/admin/support/d47dfda1-95f4-4f39-ad27-4325c36e7244'));
ok('PII flag true', msg.includes('<b>PII Flagged:</b> True'));
ok('attachment flag true', msg.includes('<b>Attachment:</b> True'));
ok('video url shown', msg.includes('loom.com/share/abc123'));
ok('pii note explains', msg.includes('kept out of this message'));

// --- the negative case -----------------------------------------------------------------------------
const clean = buildTicketMessage({ ...base, piiFlagged: false, hasAttachment: false, videoUrl: null });
ok('PII flag false', clean.includes('<b>PII Flagged:</b> False'));
ok('attachment flag false', clean.includes('<b>Attachment:</b> False'));
ok('no video line', !clean.includes('<b>Video:</b>'));
ok('no pii note when clean', !clean.includes('kept out of this message'));

// --- missing data must not produce a broken message -------------------------------------------------
const sparse = buildTicketMessage({
  id: 'x', ticketNumber: 2, repName: null, companyName: null, category: null,
  email: null, summary: null, piiFlagged: false, hasAttachment: false, videoUrl: null,
});
ok('anonymous fallback', sparse.includes('A new ticket was submitted'));
ok('category fallback', sparse.includes('Uncategorized'));
ok('email fallback', sparse.includes('not given'));
ok('summary fallback', sparse.includes('Not summarized yet'));

// --- HTML injection: a reporter controls these strings ---------------------------------------------
const nasty = buildTicketMessage({ ...base, repName: '<script>x</script>', companyName: 'A & B' });
ok('escapes angle brackets', !nasty.includes('<script>'));
ok('escapes ampersand', nasty.includes('A &amp; B'));

// --- THE SECURITY PROPERTY --------------------------------------------------------------------------
// buildTicketMessage takes no body parameter at all, so raw reported text is structurally incapable
// of reaching Telegram. This asserts the shape, not just today's behavior: if someone later adds a
// `body` field to TicketAlert, these fail.
const RAW = 'Their SSN is 238-99-2177 and their DOB is 5/11/2000';
const withBodyAttempt = buildTicketMessage({ ...base, body: RAW, description: RAW, redactedBody: RAW });
ok('raw SSN cannot appear', !withBodyAttempt.includes('238-99-2177'));
ok('raw DOB cannot appear', !withBodyAttempt.includes('5/11/2000'));
ok('no body field honored', !withBodyAttempt.includes(RAW));

console.log(`telegram alert: ${pass}/${pass + fails.length} passed`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
