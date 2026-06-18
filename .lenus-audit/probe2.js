(() => {
  const cs = el => el ? getComputedStyle(el) : null;
  const grab = el => { if (!el) return null; const s = cs(el); const r = el.getBoundingClientRect(); return { text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 20), bg: s.backgroundColor, color: s.color, border: s.borderTop !== '0px none rgb(0, 0, 0)' ? (s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor) : 'none', borderRadius: s.borderTopLeftRadius, padding: s.padding, fontSize: s.fontSize, fontWeight: s.fontWeight, h: Math.round(r.height) }; };
  const byText = t => [...document.querySelectorAll('button,a')].find(b => (b.innerText || '').trim() === t);

  const out = {};
  out.primaryBtn = grab(byText('Create'));
  out.secondaryBtn = grab(byText('Broadcast'));
  out.search = (() => { const i = document.querySelector('input[type="text"],input[type="search"],input:not([type])'); if (!i) return null; const s = cs(i); const wrap = i.closest('div'); const ws = wrap ? cs(wrap) : null; const r = (wrap || i).getBoundingClientRect(); return { bg: s.backgroundColor, border: (ws ? ws.border : s.border), borderRadius: (ws ? ws.borderTopLeftRadius : s.borderTopLeftRadius), fontSize: s.fontSize, h: Math.round(r.height), placeholder: i.placeholder }; })();
  // tag pills
  const pills = [...document.querySelectorAll('span,div')].filter(e => { const t = (e.innerText || '').trim(); if (!['TLC', 'T&F', 'PCOS', 'BRID', 'Pending'].includes(t)) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.width < 120; }).slice(0, 6).map(e => { const s = cs(e); return { text: e.innerText.trim(), bg: s.backgroundColor, color: s.color, borderRadius: s.borderTopLeftRadius, padding: s.padding, fontSize: s.fontSize, border: s.borderTopWidth + ' ' + s.borderTopColor }; });
  out.pills = pills;
  // sidebar width via the dark element at left
  const sb = document.elementFromPoint(28, 500);
  let e = sb; while (e && getComputedStyle(e).backgroundColor !== 'rgb(30, 47, 47)') e = e.parentElement;
  out.sidebarWidth = e ? Math.round(e.getBoundingClientRect().width) : null;
  // H1/H2 anywhere
  ['h1', 'h2'].forEach(t => { const el = [...document.querySelectorAll(t)].find(x => x.getBoundingClientRect().width > 0); if (el) { const s = cs(el); out[t] = { fontSize: s.fontSize, fontWeight: s.fontWeight }; } });
  return JSON.stringify(out, null, 1);
})()
