// Unit test for the Lenus check-in promotion.
//
// WHY. scripts/import-lenus-checkins.mjs writes into form_responses, which is her coach portal's
// weekly review surface. Its answer extraction was written before a single check-in body had ever
// been fetched, so its shape is a hypothesis, not a fact. That makes two properties worth pinning
// down mechanically:
//
//   1. It recognises the payload shapes it plausibly WILL meet.
//   2. When it recognises nothing it returns nothing, so the importer writes no rows, rather than
//      writing a wall of empty check-ins that look like real ones in her portal.
//
// The second property is the important one. A silent partial success is what produced the hole this
// whole workstream exists to fix.
//
// Run: node .qa-visual/lenus-checkin-import-test.mjs

import { extractAnswers, extractSubmittedAt, extractId, uuidFor, typeFor, asText } from '../scripts/import-lenus-checkins.mjs';

let pass = 0;
const fails = [];
const ok = (name, cond, detail = '') => {
  if (cond) pass++;
  else fails.push(`${name}${detail ? `: ${detail}` : ''}`);
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// --- shapes it should recognise ---------------------------------------------
eq('flat question/answer',
  extractAnswers({ checkInResponse: { answers: [{ question: 'How was your week?', answer: 'Good' }] } }),
  [{ question: 'How was your week?', answer: 'Good' }]);

eq('label/value naming',
  extractAnswers({ data: { items: [{ label: 'Weight', value: '154.4' }] } }),
  [{ question: 'Weight', answer: '154.4' }]);

eq('questionText/answerText naming',
  extractAnswers({ r: [{ questionText: 'Sleep?', answerText: '7h' }] }),
  [{ question: 'Sleep?', answer: '7h' }]);

eq('nested several levels deep',
  extractAnswers({ a: { b: { c: { d: [{ prompt: 'Mood', response: 4 }] } } } }),
  [{ question: 'Mood', answer: 4 }]);

eq('multiple answers keep order',
  extractAnswers({ answers: [{ question: 'A', answer: '1' }, { question: 'B', answer: '2' }] }),
  [{ question: 'A', answer: '1' }, { question: 'B', answer: '2' }]);

eq('the same pair surfaced twice is de-duplicated',
  extractAnswers({ top: [{ question: 'A', answer: '1' }], nested: { x: [{ question: 'A', answer: '1' }] } }),
  [{ question: 'A', answer: '1' }]);

// --- refusing, which is the point --------------------------------------------
eq('an unrecognised shape yields nothing', extractAnswers({ foo: [{ bar: 1, baz: 2 }] }), []);
eq('empty answers yield nothing', extractAnswers({ answers: [] }), []);
eq('null body yields nothing', extractAnswers(null), []);
eq('a question with no answer is not a pair', extractAnswers({ answers: [{ question: 'A' }] }), []);
eq('an empty-string answer is not an answer', extractAnswers({ answers: [{ question: 'A', answer: '' }] }), []);
eq('a null answer is not an answer', extractAnswers({ answers: [{ question: 'A', answer: null }] }), []);
eq('a blank question is not a question', extractAnswers({ answers: [{ question: '   ', answer: 'x' }] }), []);

// --- timestamps ---------------------------------------------------------------
eq('submittedAt is found', extractSubmittedAt({ r: { submittedAt: '2026-08-01T10:00:00Z' } }), '2026-08-01T10:00:00Z');
eq('the newest timestamp wins',
  extractSubmittedAt({ a: { createdAt: '2026-07-01T00:00:00Z' }, b: { submittedAt: '2026-08-01T00:00:00Z' } }),
  '2026-08-01T00:00:00Z');
// A wrong date is worse than no date: it puts a May check-in at the top of her list as today's.
eq('no timestamp returns null, never today', extractSubmittedAt({ answers: [] }), null);

// --- ids and idempotency --------------------------------------------------------
eq('id is found', extractId({ checkInResponse: { id: 'ckin-abc-123', answers: [] } }), 'ckin-abc-123');
eq('a short id is not an id', extractId({ x: { id: 'ab' } }), null);

const u1 = uuidFor('ckin-abc-123');
ok('uuidFor is deterministic, which is what makes the import idempotent', u1 === uuidFor('ckin-abc-123'));
ok('uuidFor separates distinct check-ins', u1 !== uuidFor('ckin-abc-124'));
ok('uuidFor emits a legal v5 uuid',
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(u1), u1);

// --- rendering ------------------------------------------------------------------
eq('short answers stay text', typeFor('Good'), 'text');
eq('long answers become multiline', typeFor('x'.repeat(200)), 'multiline');
eq('a non-string answer does not become multiline', typeFor(5), 'text');
eq('objects survive as JSON rather than [object Object]', asText({ hours: 7 }), '{"hours":7}');
eq('null renders empty, not the string null', asText(null), '');

// --- the whole body, end to end ---------------------------------------------------
const body = {
  checkInResponse: {
    id: 'resp-9f2c-0001',
    submittedAt: '2026-08-05T14:22:00Z',
    answers: [
      { question: 'How did training feel?', answer: 'Strong, hit all my sets' },
      { question: 'Weight this week', answer: '154.4' },
      { question: 'Anything else?', answer: '' },
    ],
  },
};
const pairs = extractAnswers(body);
eq('the blank answer is dropped, the real two are kept', pairs.length, 2);
eq('submission date is read off the body', extractSubmittedAt(body), '2026-08-05T14:22:00Z');
eq('the response id drives the deterministic row id', extractId(body), 'resp-9f2c-0001');

console.log(`\n${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL  ${f}`);
process.exit(fails.length ? 1 : 0);
