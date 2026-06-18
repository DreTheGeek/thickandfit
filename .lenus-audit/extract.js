(() => {
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const vis = el => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
  };
  const uniq = arr => [...new Set(arr)];

  // Navigation: anchors + role=navigation
  const navRegions = [...document.querySelectorAll('nav, [role="navigation"], aside')];
  const navLinks = uniq([...document.querySelectorAll('a[href]')]
    .filter(vis)
    .map(a => {
      const t = clean(a.innerText || a.getAttribute('aria-label') || a.title);
      const href = a.getAttribute('href');
      const active = a.getAttribute('aria-current') || /active|selected/.test(a.className) ? 'ACTIVE' : '';
      return t || href ? `${active ? '[ACTIVE] ' : ''}${t} -> ${href}` : '';
    }).filter(Boolean));

  // Headings
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')]
    .filter(vis).map(h => `${h.tagName}: ${clean(h.innerText)}`).filter(x => clean(x).length > 4);

  // Tabs
  const tabs = [...document.querySelectorAll('[role="tab"], [role="tablist"] *')]
    .filter(vis).map(t => clean(t.innerText)).filter(Boolean);

  // Buttons
  const buttons = uniq([...document.querySelectorAll('button, [role="button"], a[class*="btn"], a[class*="button"]')]
    .filter(vis)
    .map(b => {
      const t = clean(b.innerText || b.getAttribute('aria-label') || b.title);
      return t;
    }).filter(Boolean));

  // Inputs
  const inputs = [...document.querySelectorAll('input, textarea, select')]
    .filter(vis)
    .map(i => {
      let label = '';
      if (i.id) { const l = document.querySelector(`label[for="${CSS.escape(i.id)}"]`); if (l) label = clean(l.innerText); }
      if (!label && i.getAttribute('aria-label')) label = clean(i.getAttribute('aria-label'));
      if (!label) { const p = i.closest('label'); if (p) label = clean(p.innerText); }
      const type = i.tagName === 'SELECT' ? 'select' : (i.type || i.tagName.toLowerCase());
      const ph = i.placeholder || '';
      let opts = '';
      if (i.tagName === 'SELECT') opts = ' opts=[' + [...i.options].map(o => clean(o.text)).join('|') + ']';
      return `${type} | label="${label}" | placeholder="${ph}"${opts}`;
    });

  // Tables
  const tables = [...document.querySelectorAll('table, [role="table"], [role="grid"]')].filter(vis).map(tb => {
    const heads = [...tb.querySelectorAll('th, [role="columnheader"]')].map(h => clean(h.innerText)).filter(Boolean);
    const rows = [...tb.querySelectorAll('tr, [role="row"]')].slice(0, 6).map(r => clean(r.innerText)).filter(Boolean);
    return { columns: heads, sampleRows: rows };
  });

  // Main content text (prefer main, else body) - trimmed
  const mainEl = document.querySelector('main, [role="main"], #main, .main-content') || document.body;
  let mainText = clean(mainEl.innerText).slice(0, 6000);

  return JSON.stringify({
    url: location.href,
    title: document.title,
    headings,
    tabs: uniq(tabs),
    navLinks,
    buttons,
    inputs,
    tables,
    mainText
  }, null, 1);
})()
