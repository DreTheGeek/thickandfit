// Minimal CDP driver for the launchproof debug Chrome on :9222
// Usage:
//   node cdp.mjs nav <url>            navigate + wait for load + settle
//   node cdp.mjs eval '<js>'          run JS in page, print JSON result
//   node cdp.mjs evalfile <path>      run JS from a file, print JSON result
//   node cdp.mjs shot <outpath>       full-page screenshot to PNG
//   node cdp.mjs url                  print current page url+title

const PORT = process.env.LP_CHROME_PORT || 9222;

async function pickTarget() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json`);
  const tabs = await res.json();
  // Prefer a real page on lenus.io, else any http page
  let t = tabs.find(x => x.type === 'page' && /lenus\.io/.test(x.url));
  if (!t) t = tabs.find(x => x.type === 'page' && /^https?:/.test(x.url));
  if (!t) throw new Error('no page target found');
  return t;
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let idc = 0;
    const listeners = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const l of listeners) l(msg);
      }
    };
    ws.onerror = (e) => reject(new Error('ws error ' + (e.message || '')));
    ws.onopen = () => {
      const send = (method, params = {}) => new Promise((res, rej) => {
        const id = ++idc;
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
      const onEvent = (fn) => listeners.push(fn);
      resolve({ ws, send, onEvent });
    };
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const t = await pickTarget();
  const { ws, send, onEvent } = await connect(t.webSocketDebuggerUrl);

  try {
    if (cmd === 'nav') {
      const url = rest[0];
      await send('Page.enable');
      let loaded = false;
      onEvent(m => { if (m.method === 'Page.loadEventFired') loaded = true; });
      await send('Page.navigate', { url });
      // wait for load event up to 15s
      for (let i = 0; i < 150 && !loaded; i++) await sleep(100);
      await sleep(3500); // settle for SPA XHR/render
      const r = await send('Runtime.evaluate', { expression: 'JSON.stringify({url:location.href,title:document.title})', returnByValue: true });
      console.log(r.result.value);
    } else if (cmd === 'eval' || cmd === 'evalfile') {
      const fs = await import('node:fs');
      let expr = cmd === 'evalfile' ? fs.readFileSync(rest[0], 'utf8') : rest[0];
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        console.error('EVAL_EXCEPTION:', JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
        process.exitCode = 2;
      } else {
        const v = r.result.value;
        console.log(typeof v === 'string' ? v : JSON.stringify(v));
      }
    } else if (cmd === 'shot') {
      const out = rest[0];
      await send('Page.enable');
      const metrics = await send('Page.getLayoutMetrics');
      const cs = metrics.cssContentSize || metrics.contentSize;
      const clip = { x: 0, y: 0, width: Math.ceil(cs.width), height: Math.min(Math.ceil(cs.height), 20000), scale: 1 };
      const r = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
      const fs = await import('node:fs');
      fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
      console.log('SHOT_OK ' + out + ' ' + clip.width + 'x' + clip.height);
    } else if (cmd === 'clicktext') {
      // clicktext "<text>" [occurrence] : trusted click at center of first visible element whose innerText includes text
      const text = rest[0];
      const occ = parseInt(rest[1] || '0', 10);
      const expr = `(()=>{const t=${JSON.stringify(text)};const els=[...document.querySelectorAll('button,a,tr,td,div,span,li,[role=button],[role=row],h6,p')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&e.innerText&&e.innerText.trim().includes(t);});els.sort((a,b)=>(a.innerText.length)-(b.innerText.length));const el=els[${occ}];if(!el)return null;const r=el.getBoundingClientRect();return JSON.stringify({x:r.x+Math.min(r.width/2,40),y:r.y+r.height/2});})()`;
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (!r.result.value) { console.log('NOTFOUND'); }
      else {
        const { x, y } = JSON.parse(r.result.value);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
        await sleep(3000);
        const u = await send('Runtime.evaluate', { expression: 'JSON.stringify({url:location.href,title:document.title})', returnByValue: true });
        console.log('CLICKED ' + u.result.value);
      }
    } else if (cmd === 'clickxy') {
      const x = parseFloat(rest[0]), y = parseFloat(rest[1]);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await sleep(2500);
      const u = await send('Runtime.evaluate', { expression: 'JSON.stringify({url:location.href,title:document.title})', returnByValue: true });
      console.log('CLICKED ' + u.result.value);
    } else if (cmd === 'url') {
      const r = await send('Runtime.evaluate', { expression: 'JSON.stringify({url:location.href,title:document.title})', returnByValue: true });
      console.log(r.result.value);
    } else {
      console.error('unknown cmd: ' + cmd);
      process.exitCode = 1;
    }
  } finally {
    ws.close();
  }
}

main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
