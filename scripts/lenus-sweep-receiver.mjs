// Local receiver for the Lenus sweep.
//
// Getting bytes off her logged-in Lenus tab is harder than it looks, and both obvious routes fail:
//
//   * Downloads: the FIRST anchor-click download lands (as ~/Downloads/<uuid>.tmp, never renamed).
//     Every one after that is silently dropped, because Chrome's "automatic multiple downloads"
//     permission is denied for the origin. A reload does not restore it and a real click does not
//     either, so it is one payload per origin, not per page load.
//   * fetch() to localhost: Lenus sends `default-src https://us.lenus.io` plus a connect-src
//     allowlist and `upgrade-insecure-requests`. The receiver is reachable by curl and invisible to
//     the page. It fails as an opaque "TypeError: Failed to fetch".
//
// So the page never talks to this server. Instead the payload is parked on `window.name`, the tab
// is navigated HERE by the extension (a browser-level navigation, which no page CSP governs), and
// the collector page below posts it back same-origin.
import { createServer } from 'node:http';
import { writeFileSync, readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const OUT_DIR = process.argv[2];
const PORT = Number(process.argv[3] || 8877);
mkdirSync(OUT_DIR, { recursive: true });

const COLLECTOR = `<!doctype html><meta charset="utf-8"><title>TF collect</title>
<body style="font:16px system-ui;padding:24px">
<h1 id="s">collecting...</h1>
<script>
(async () => {
  const raw = window.name || '';
  const s = document.getElementById('s');
  if (!raw) { s.textContent = 'EMPTY: window.name did not survive the navigation'; return; }
  // Same-origin POST: this page has no CSP of its own, so nothing blocks it.
  const r = await fetch('/save', { method: 'POST', headers: { 'content-type': 'application/json', 'x-tf-name': (new URLSearchParams(location.search).get('name') || 'sweep.json') }, body: raw });
  const j = await r.json();
  window.name = '';
  s.textContent = 'SAVED ' + j.bytes + ' bytes -> ' + j.name;
})();
</script>`;

// The transport runs both ways. /inject parks a file from disk onto window.name so the next
// navigation carries it INTO the Lenus tab, which is how the 265 profile ids get there without
// being pasted into a script every time the page reloads.
const INJECT = (payload) => `<!doctype html><meta charset="utf-8"><title>TF inject</title>
<body style="font:16px system-ui;padding:24px"><h1>injected</h1>
<script>window.name = ${JSON.stringify(payload)};</script>`;

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/inject') {
    const name = basename(String(url.searchParams.get('file') || '')).replace(/[^\w.-]/g, '_');
    let payload = '';
    try { payload = readFileSync(join(OUT_DIR, name), 'utf8'); } catch { payload = ''; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(INJECT(payload));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/save') {
    const name = basename(String(req.headers['x-tf-name'] || 'sweep.json')).replace(/[^\w.-]/g, '_');
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      writeFileSync(join(OUT_DIR, name), buf);
      appendFileSync(join(OUT_DIR, '_log.txt'), `${new Date().toISOString()} ${name} ${buf.length}\n`);
      console.log(`WROTE ${name} ${buf.length}`);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, bytes: buf.length, name }));
    });
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(COLLECTOR);
});

server.listen(PORT, '127.0.0.1', () => console.log(`receiver on ${PORT} -> ${OUT_DIR}`));
