// Live runtime crawl of prod (= main). Logs in as coach + subscriber, visits every route,
// records HTTP status, final URL (auth bounces / redirects), console errors, page errors.
const path = require('path');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'https://thicknfit.kaldrtech.com';
const ID = { client: '8a428c79-e383-4b02-8233-35a3732d4eb5', recipe: '383d7947-50c2-4aca-9639-16889cab3cbc', sub: '4df435f9-dc5f-4e11-b07e-ff1672ce408d', opp: '000f7347-1fa9-4766-b420-93bb0ed48d15', mealPlan: '13c42116-e36e-4ab5-ba10-a9041356bc74', plan: '463363c1-8b8e-4821-bc98-2aa91f525692', leadContact: '2b533b53-1949-4418-9a20-29a2d5542657' };

const COACH = [
  '/coach', '/coach/clients', `/coach/clients/${ID.client}`, '/coach/leads', `/coach/leads/${ID.opp}`, `/coach/leads/${ID.leadContact}`,
  '/coach/subscribers', `/coach/subscribers/${ID.sub}`, '/coach/programs', `/coach/programs/${ID.plan}`, '/coach/forms',
  '/coach/broadcasts', '/coach/community', '/coach/inbox', '/admin/health', '/coach/settings',
  '/coach/tool/recipes', `/coach/tool/recipes/${ID.recipe}`, '/coach/tool/recipe-books', '/coach/tool/meal-plans', `/coach/tool/meal-plans/${ID.mealPlan}`, '/coach/tool/ingredients',
];
const SUB = ['/dashboard', '/you', '/account', '/activities', '/nutrition', `/workout/${ID.plan}`];

async function login(p, email) {
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.type('input[name=email]', email);
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 2500));
}
async function crawl(p, routes, tag) {
  for (const route of routes) {
    const cerr = [], perr = [];
    const ch = (m) => { if (m.type() === 'error' && !/webpack-hmr|ERR_INVALID_HTTP_RESPONSE/.test(m.text())) cerr.push(m.text().slice(0, 120)); };
    const ph = (e) => perr.push(e.message.slice(0, 160));
    p.on('console', ch); p.on('pageerror', ph);
    let status = 0;
    try { const r = await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 45000 }); status = r ? r.status() : 0; } catch (e) { perr.push('NAV ' + e.message.slice(0, 80)); }
    await new Promise((r) => setTimeout(r, 1200));
    const finalPath = new URL(p.url()).pathname;
    p.off('console', ch); p.off('pageerror', ph);
    const bounced = finalPath === '/auth/sign-in' && route !== '/auth/sign-in';
    const flag = status >= 400 || bounced || perr.length || cerr.length ? 'FLAG' : 'ok';
    console.log(`[${tag}] ${flag} ${status} ${route}${finalPath !== route ? ' ->' + finalPath : ''}${perr.length ? ' PERR:' + perr[0] : ''}${cerr.length ? ' CERR:' + cerr[0] : ''}`);
  }
}
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
  await login(p, 'sample.casey@thickandfit.test');
  await crawl(p, COACH, 'coach');
  await login(p, 'sample.sam@thickandfit.test');
  await crawl(p, SUB, 'sub');
  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
