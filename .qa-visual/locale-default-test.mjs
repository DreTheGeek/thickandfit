// First-visit locale resolution. Imports the REAL module (Node strips the TS types).
//
// The bug this locks down: Dre signed in from an English browser and got a Spanish app on
// 2026-07-31. Accept-Language said en-US and nothing in the resolution chain looked at it, because
// IP country was treated as the only signal. An explicit browser preference must beat a geolocation
// inference, which is wrong for travellers, VPNs, and carrier egress.
import {
  localeFromAcceptLanguage,
  localeForCountry,
  firstVisitLocale,
} from '../src/lib/i18n/geo.ts';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

// --- THE BUG ---------------------------------------------------------------------------------
ok('THE BUG: en-US browser gets English', firstVisitLocale('en-US,en;q=0.9', 'US') === 'en');
// ...and it must hold even when the IP says otherwise, which is the whole point of the precedence.
ok('en browser in Mexico gets English', firstVisitLocale('en-US,en;q=0.9', 'MX') === 'en');
ok('es browser in the US gets Spanish', firstVisitLocale('es-MX,es;q=0.9', 'US') === 'es');

// --- Accept-Language parsing --------------------------------------------------------------------
ok('plain en', localeFromAcceptLanguage('en') === 'en');
ok('en-US', localeFromAcceptLanguage('en-US') === 'en');
ok('en-GB', localeFromAcceptLanguage('en-GB') === 'en');
ok('es-419', localeFromAcceptLanguage('es-419') === 'es');
ok('es-MX', localeFromAcceptLanguage('es-MX') === 'es');
ok('case insensitive', localeFromAcceptLanguage('EN-us') === 'en');
ok('whitespace tolerated', localeFromAcceptLanguage('  es-MX , en ; q=0.5 ') === 'es');

// q-weights: a naive first-match would answer Spanish here and be wrong.
ok('q-weight respected', localeFromAcceptLanguage('es;q=0.8, en;q=1.0') === 'en');
ok('q-weight reversed', localeFromAcceptLanguage('en;q=0.3, es;q=0.9') === 'es');
ok('implicit q=1 beats explicit lower', localeFromAcceptLanguage('en, es;q=0.9') === 'en');
ok('earlier wins a tie', localeFromAcceptLanguage('es;q=0.9, en;q=0.9') === 'es');
// q=0 is an explicit REJECTION, not a weak preference.
ok('q=0 rejects', localeFromAcceptLanguage('es;q=0, en;q=0.5') === 'en');

// Unsupported languages must yield null so the caller falls through to geolocation rather than
// having this function quietly pick for them.
ok('french -> null', localeFromAcceptLanguage('fr-FR,fr;q=0.9') === null);
ok('wildcard -> null', localeFromAcceptLanguage('*') === null);
ok('empty -> null', localeFromAcceptLanguage('') === null);
ok('null -> null', localeFromAcceptLanguage(null) === null);
ok('undefined -> null', localeFromAcceptLanguage(undefined) === null);
ok('garbage -> null', localeFromAcceptLanguage(';;;,,,') === null);
// A supported language further down the list still counts.
ok('fr then es', localeFromAcceptLanguage('fr-FR,fr;q=0.9,es;q=0.8') === 'es');

// --- geolocation, unchanged for the case it is good at -------------------------------------------
ok('MX -> es', localeForCountry('MX') === 'es');
ok('PR -> es', localeForCountry('PR') === 'es');
ok('ES -> es', localeForCountry('ES') === 'es');
ok('US -> en', localeForCountry('US') === 'en');
ok('GB -> en', localeForCountry('GB') === 'en');
ok('lowercase country', localeForCountry('mx') === 'es');
ok('null country -> en', localeForCountry(null) === 'en');
ok('unknown country -> en', localeForCountry('ZZ') === 'en');

// --- fallthrough: no browser opinion, so geolocation decides -------------------------------------
ok('no header, MX ip -> es', firstVisitLocale(null, 'MX') === 'es');
ok('no header, US ip -> en', firstVisitLocale(null, 'US') === 'en');
ok('french browser, MX ip -> es', firstVisitLocale('fr-FR', 'MX') === 'es');
ok('french browser, US ip -> en', firstVisitLocale('fr-FR', 'US') === 'en');
ok('nothing at all -> en', firstVisitLocale(null, null) === 'en');

console.log(`locale default: ${pass}/${pass + fails.length} passed`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
