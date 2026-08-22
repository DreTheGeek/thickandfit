// Open every screen of the coach console on PRODUCTION, signed in as a real coach, and fail if any
// of them is broken. The `portal-shots.mjs` of the other half of the app.
//
// WHY THIS EXISTS. The member portal has had a production surface sweep since the 8.0 re-skin and
// it earns its keep: the first run after its credentials were repaired found /progress rendering a
// weight chart with NaN coordinates, on the default tab, for every member with no weight logged.
// The coach console had nothing equivalent. It is the larger half - 31 static screens and 12
// dynamic ones against the portal's eleven - and it is the half Stephanie and her assistant coaches
// actually live in.
//
// The gap mattered more here than anywhere else because of this app's own convention. Reads fail
// open: `console.error` then `return []`. So an unapplied migration, a dropped column or a null
// company scope does not throw, it renders a calm empty screen. That is exactly what happened for
// five days in August, when her whole 41-program library read as EMPTY in `/coach/programs` and in
// the assignment picker, with no error page anywhere and no Sentry spike - because there is no
// Sentry DSN either. Nothing in the repo could have caught it. This can.
//
//   node .qa-visual/coach-shots.mjs                  phone 390x844
//   node .qa-visual/coach-shots.mjs --desktop        1440x1000, where the sidebar appears
//   node .qa-visual/coach-shots.mjs --es             Spanish, via the ui_locale cookie
//   node .qa-visual/coach-shots.mjs --only=programs  one screen, by substring
//   node .qa-visual/coach-shots.mjs http://127.0.0.1:3000
//
// READ-ONLY BY CONSTRUCTION. It navigates and screenshots. It never clicks a control that writes,
// which is why it can be pointed at production without a seeded tenant. Anything needing a click
// belongs in a named test (`invite-desk-test.mjs` is the model) where the write is deliberate and
// its cleanup is written next to it.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { COACH, BASE_URL, signIn } from './qa-accounts.mjs';

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith('http')) ?? BASE_URL;
const DESKTOP = args.includes('--desktop');
const ES = args.includes('--es');
const ONLY = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7);
const SHOOT = !args.includes('--no-shots');

// 390 is the phone the member portal was designed against and the width a coach checks her console
// at from bed. 1440 is past `lg`, where the sidebar replaces the mobile nav - a genuinely different
// layout rather than the same one wider, which is the only reason to shoot it twice.
const VIEWPORT = DESKTOP ? { width: 1440, height: 1000 } : { width: 390, height: 844 };
const OUT = path.join(process.cwd(), '.qa-visual', 'coach', `${DESKTOP ? 'desktop' : 'phone'}${ES ? '-es' : ''}`);

/**
 * Every static screen in the console, in sidebar order.
 *
 * `expect` is a marker of the screen's OWN content, not of the chrome. A page that throws still
 * renders the header, the sidebar and the footer, so asserting on those passes a screen that is
 * entirely an error boundary. Where a screen's only honest state today is empty (no campaigns
 * written yet, no coach away), the marker is its empty-state copy, which is a real assertion: it
 * proves the page reached its own render rather than something else's.
 *
 * EVERY MARKER CARRIES ITS SPANISH. The first --es run reported eleven screens broken, and all
 * eleven were rendering perfectly in Spanish: the markers were English words. A checker that
 * fails on the language rather than on the screen gets its Spanish mode switched off, which is
 * the mode that finds the interesting things - it is the run that caught the untranslated
 * checklist on the coach home. Words are taken from the rendered pages, not from es.json, so a
 * key that exists but is never rendered cannot satisfy one.
 */
const SCREENS = [
  ['/coach', 'overview', /needs you|attention|today|overview|resumen del negocio|esperan respuesta/i],
  ['/coach/getting-started', 'getting-started', /getting started|tour|step|primeros pasos|paso/i],
  ['/coach/clients', 'clients', /client|cliente/i],
  ['/coach/subscribers', 'subscribers', /subscriber|member|miembro|suscript/i],
  ['/coach/awaiting', 'awaiting', /awaiting|waiting|program|plan|esperan|esperando/i],
  ['/coach/quiet', 'quiet', /quiet|risk|active|silencio|riesgo|activ/i],
  ['/coach/intake', 'intake', /intake|health|form|salud|formulario/i],
  ['/coach/inbox', 'inbox', /message|inbox|thread|mensaje|conversaci/i],
  ['/coach/invites', 'invites', /in the app|invited|not asked yet|en la app|invitaci/i],
  ['/coach/leads', 'leads', /lead|stage|pipeline|prospecto|etapa/i],
  ['/coach/billing', 'billing', /billing|subscription|revenue|payment|cobros|renovaciones/i],
  ['/coach/plan-renewals', 'plan-renewals', /renew|expir|plan|renov|vence/i],
  ['/coach/assignments', 'assignments', /assign|program|client|asignaci|cliente/i],
  ['/coach/programs', 'programs', /program|plan|week|semana/i],
  ['/coach/exercises', 'exercises', /exercise|movement|demo|ejercicio|movimiento/i],
  // NOT /training/: the word only appears in the SIDEBAR, so this marker passed at desktop and
  // failed at 390 where the sidebar is gone. Exactly the trap the note above warns about, walked
  // into on the first draft. These two read the screen's own copy instead.
  ['/coach/training', 'training', /how-?to|getting started|first day|c[oó]mo|primer d[ií]a/i],
  ['/coach/forms', 'forms', /form|check-?in|question|formulario|pregunta/i],
  ['/coach/challenges', 'challenges', /challenge|reto/i],
  ['/coach/community', 'community', /community|post|feed|comunidad|publica/i],
  ['/coach/campaigns', 'campaigns', /campaign|season|window|campa[nñ]a|ventana/i],
  ['/coach/approvals', 'approvals', /approv|review|pending|queue|aprob|aprueba|revisa/i],
  ['/coach/drafts', 'drafts', /draft|borrador/i],
  ['/coach/coverage', 'coverage', /cover|away|coach|cobertura|ausencia/i],
  ['/coach/method', 'method', /method|know|needs you|configured|m[eé]todo|conocimiento/i],
  ['/coach/spanish', 'spanish', /spanish|espa[nñ]ol|translat|to go|traduc|faltan/i],
  ['/coach/tool/lessons', 'tool-lessons', /lesson|lecci/i],
  ['/coach/tool/meal-plans', 'tool-meal-plans', /meal plan|plan|plan(es)? de comida/i],
  ['/coach/tool/meal-plans/new', 'tool-meal-plans-new', /meal plan|new|name|calor|nuevo|nombre/i],
  ['/coach/tool/recipes', 'tool-recipes', /recipe|receta/i],
  ['/coach/tool/recipe-books', 'tool-recipe-books', /recipe book|book|libros? de recetas/i],
  ['/coach/tool/protocols', 'tool-protocols', /protocol|protocolo/i],
  ['/coach/settings', 'settings', /setting|account|coach|ajuste|configuraci|cuenta/i],
  ['/coach/settings/coaching', 'settings-coaching', /coaching|cadence|reminder|check-?in|recordatorio|cadencia/i],
  ['/coach/settings/client-app', 'settings-client-app', /client app|app|member|miembro|clienta/i],
  ['/coach/settings/knowledge', 'settings-knowledge', /knowledge|document|source|conocimiento|documento/i],
  ['/coach/settings/knowledge/interview', 'settings-interview', /interview|question|answer|entrevista|pregunta/i],
];

/**
 * The screens whose URL carries a real id.
 *
 * Resolved by reading a link off the list page that owns them rather than hardcoding a uuid,
 * for two reasons. A pinned id rots the moment the row is archived, and this is the only shape of
 * check that can notice a list page rendering NO links at all - which is precisely what the empty
 * `/coach/programs` looked like in August, and is invisible to a checker that already knows the id.
 */
const DYNAMIC = [
  { from: '/coach/clients', match: /^\/coach\/clients\/[0-9a-f-]{36}$/, name: 'client-detail', expect: /client|weight|check-?in|message|cliente|peso|mensaje/i },
  { from: '/coach/subscribers', match: /^\/coach\/subscribers\/[0-9a-f-]{36}$/, name: 'subscriber-detail', expect: /subscriber|member|plan|coach|miembro|suscript/i },
  { from: '/coach/leads', match: /^\/coach\/leads\/[0-9a-f-]{36}$/, name: 'lead-detail', expect: /lead|stage|contact|note|prospecto|etapa|nota/i },
  { from: '/coach/programs', match: /^\/coach\/programs\/[0-9a-f-]{36}$/, name: 'program-detail', expect: /week|day|exercise|session|program|semana|d[ií]a|ejercicio/i },
  { from: '/coach/exercises', match: /^\/coach\/exercises\/[0-9a-f-]{36}$/, name: 'exercise-detail', expect: /exercise|demo|muscle|equipment|video|ejercicio|m[uú]sculo|equipo/i },
  { from: '/coach/forms', match: /^\/coach\/forms\/[0-9a-f-]{36}$/, name: 'form-detail', expect: /form|question|field|formulario|pregunta|campo/i },
  { from: '/coach/forms', match: /^\/coach\/forms\/[0-9a-f-]{36}$/, suffix: '/responses', name: 'form-responses', expect: /response|answer|submitted|no responses|respuesta|enviad/i },
  { from: '/coach/tool/lessons', match: /^\/coach\/tool\/lessons\/[0-9a-f-]{36}$/, name: 'lesson-detail', expect: /lesson|content|module|lecci|contenido|m[oó]dulo/i },
  { from: '/coach/tool/meal-plans', match: /^\/coach\/tool\/meal-plans\/[0-9a-f-]{36}$/, name: 'meal-plan-detail', expect: /meal|calor|protein|day|comida|prote[ií]na|d[ií]a/i },
  { from: '/coach/tool/meal-plans', match: /^\/coach\/tool\/meal-plans\/[0-9a-f-]{36}$/, suffix: '/edit', name: 'meal-plan-edit', expect: /meal|save|calor|edit|comida|guardar|editar/i },
  { from: '/coach/tool/recipes', match: /^\/coach\/tool\/recipes\/[0-9a-f-]{36}$/, name: 'recipe-detail', expect: /recipe|ingredient|serving|step|receta|ingrediente|porci/i },
  { from: '/coach/tool/protocols', match: /^\/coach\/tool\/protocols\/[0-9a-f-]{36}$/, name: 'protocol-detail', expect: /protocol|phase|day|week|protocolo|fase|d[ií]a|semana/i },
  // "All how-tos" is this screen's own back link, present on every slug, and the reading time
  // ("8 min") is the second marker. Neither appears in the chrome, which is the whole point.
  { from: '/coach/training', match: /^\/coach\/training\/[a-z0-9-]+$/, name: 'training-detail', expect: /all how-?tos|\b\d+ ?min\b|todos los|c[oó]mo/i },
];

/** The error boundary's own copy, in both catalogs. A thrown page renders THIS behind a 200. */
const ERROR_MARKER = /something went wrong|algo sali[oó] mal/i;

/**
 * A next-intl key that never resolved, rendered verbatim. `coach.clientsTitle` on screen is a
 * missing translation, and the Spanish run is where these actually surface. Anchored to a
 * lowercase namespace + camelCase key so ordinary prose and file names do not trip it.
 */
const RAW_KEY = /\b(?:coach|app|common|nav|marketing|funnel|auth)\.[a-z][A-Za-z0-9]{3,}\b/;

/**
 * Stored HTML printed as its own source. Her migrated Lenus messages are HTML, and any screen that
 * renders a body without lib/messages/body-text.ts shows the markup:
 *
 *     <p>Hi Thais 👋🏼</p><p><br></p><p></p><p>Check-in time! ⏰ Head to the app now...
 *
 * The conversation pane was fixed for this; the thread list one file over was not, and 37 of her 86
 * threads previewed like that. It is checked generically rather than per screen because the same
 * rows reach the client record, the campaign preview and anything else that quotes a message.
 */
const RAW_HTML = /<\/?(?:p|br|div|span|strong|em|ul|ol|li|h[1-6])\b[^>]*>/i;

/**
 * The replacement character. It is what a browser's parser substitutes for a lone surrogate, which
 * is what a body containing an emoji gets when it is truncated with a code-unit slice. It also
 * means React's tree and the DOM now hold different text, so it arrives WITH a hydration error.
 */
const REPLACEMENT_CHAR = /�/;

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await ctx.newPage();

let problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 180)}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 180)}`));

console.log(`base: ${BASE}  viewport: ${VIEWPORT.width}x${VIEWPORT.height}  locale: ${ES ? 'es' : 'en'}`);
try {
  const landed = await signIn(page, COACH, BASE);
  console.log(`signed in, landed on ${new URL(landed).pathname}\n`);
} catch (e) {
  console.error(String(e.message));
  await browser.close();
  process.exit(1);
}

if (ES) {
  // AFTER sign-in. The sign-in action writes ui_locale from the coach's PROFILE, so a cookie set
  // first is overwritten and the whole run comes back in English reporting every screen green.
  // portal-shots.mjs paid for this one already.
  await ctx.addCookies([{ name: 'ui_locale', value: 'es', url: BASE }]);
  console.log('ui_locale cookie set to es (post-login)\n');
}

const results = [];

async function visit(route, name, expect) {
  problems = [];
  let text = '';
  let status = 0;
  try {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60_000 });
    status = res?.status() ?? 0;
  } catch {
    // networkidle can time out on a screen holding an open stream; the assertions below still run
    // against whatever rendered, which is the honest thing to measure.
  }
  await page.waitForTimeout(900);
  text = await page.locator('body').innerText().catch(() => '');

  const failures = [];
  if (ERROR_MARKER.test(text)) failures.push('renders the error boundary');
  if (status >= 400) failures.push(`HTTP ${status}`);
  if (text.replace(/\s+/g, ' ').trim().length < 60) failures.push('page is essentially blank');
  if (expect && !expect.test(text)) failures.push(`no content marker (${expect})`);
  const rawKey = text.match(RAW_KEY);
  if (rawKey) failures.push(`raw i18n key on screen: ${rawKey[0]}`);
  const rawHtml = text.match(RAW_HTML);
  if (rawHtml) failures.push(`stored HTML printed as source: ${rawHtml[0]}`);
  if (REPLACEMENT_CHAR.test(text)) failures.push('a replacement character on screen (truncated mid-emoji)');
  // A console error is reported but does NOT fail the screen on its own: production carries
  // third-party noise (a blocked analytics beacon, an aborted prefetch) that says nothing about
  // this app. React's own render errors reach `pageerror` and DO fail, and so do the NaN-attribute
  // errors below, which are ours by definition.
  const ours = problems.filter((p) => p.startsWith('pageerror') || /NaN|MISSING_MESSAGE|Hydration|#418|#423|#425/.test(p));
  if (ours.length) failures.push(`${ours.length} app-level console error(s)`);

  if (SHOOT) {
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true }).catch(() => {});
  }

  const label = `${name.padEnd(22)} ${route.padEnd(42)}`;
  if (failures.length) {
    console.log(`  ${label} FAIL`);
    for (const f of failures) console.log(`      ${f}`);
    for (const p of problems.slice(0, 6)) console.log(`      ${p}`);
  } else {
    console.log(`  ${label} ok`);
  }
  results.push({ name, route, failures });
}

for (const [route, name, expect] of SCREENS) {
  if (ONLY && !name.includes(ONLY) && !route.includes(ONLY)) continue;
  await visit(route, name, expect);
}

console.log('');
for (const d of DYNAMIC) {
  if (ONLY && !d.name.includes(ONLY)) continue;
  await page.goto(`${BASE}${d.from}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(900);
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') ?? ''));
  const href = hrefs.find((h) => d.match.test(h.split('?')[0]));
  if (!href) {
    // Not a skip. A list page offering no link to its own detail screen is the empty-console
    // failure this tool exists to catch, so it is a FAIL with the reason named.
    console.log(`  ${d.name.padEnd(22)} ${d.from.padEnd(42)} FAIL`);
    console.log(`      ${d.from} linked no ${d.match} - the list is empty or its links changed shape`);
    results.push({ name: d.name, route: d.from, failures: ['list page offered no detail link'] });
    continue;
  }
  await visit(`${href.split('?')[0]}${d.suffix ?? ''}`, d.name, d.expect);
}

await browser.close();

const broken = results.filter((r) => r.failures.length);
console.log(`\n${SHOOT ? `shots -> ${OUT}\n` : ''}${results.length - broken.length}/${results.length} screens clean`);
if (broken.length) {
  console.error(`\nFAILED: ${broken.length} screen(s) broken`);
  for (const b of broken) console.error(`  ${b.name} (${b.route}): ${b.failures.join('; ')}`);
}
process.exit(broken.length ? 1 : 0);
