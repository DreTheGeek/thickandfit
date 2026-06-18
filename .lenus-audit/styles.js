(() => {
  const cs = el => el ? getComputedStyle(el) : null;
  const pick = (el, props) => { const s = cs(el); const o = {}; if (!s) return null; props.forEach(p => o[p] = s[p]); return o; };
  const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none'; };

  const body = pick(document.body, ['fontFamily', 'fontSize', 'color', 'backgroundColor', 'lineHeight']);

  // headings sizes
  const headingSizes = {};
  ['h1', 'h2', 'h3', 'h4', 'h5'].forEach(t => {
    const el = [...document.querySelectorAll(t)].find(vis);
    if (el) headingSizes[t] = pick(el, ['fontSize', 'fontWeight', 'lineHeight', 'color', 'fontFamily']);
  });

  // sidebar / nav
  const nav = document.querySelector('nav, aside, [role="navigation"]');
  const navStyle = nav ? { ...pick(nav, ['backgroundColor', 'width', 'color']), rect: nav.getBoundingClientRect().width } : null;

  // buttons - sample distinct background colors
  const btns = [...document.querySelectorAll('button, a[class*="btn"], [role="button"]')].filter(vis).slice(0, 40);
  const btnStyles = btns.map(b => {
    const s = cs(b);
    return { text: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24), bg: s.backgroundColor, color: s.color, border: s.border, borderRadius: s.borderRadius, padding: s.padding, fontSize: s.fontSize, fontWeight: s.fontWeight };
  });
  // dedupe by bg+color
  const seen = new Set();
  const btnUniq = btnStyles.filter(b => { const k = b.bg + b.color + b.borderRadius; if (seen.has(k)) return false; seen.add(k); return true; });

  // cards: divs with border-radius and (shadow or border) and decent size
  const cards = [...document.querySelectorAll('div, section, article')].filter(el => {
    if (!vis(el)) return false;
    const s = cs(el); const r = el.getBoundingClientRect();
    const br = parseFloat(s.borderTopLeftRadius);
    const hasShadow = s.boxShadow && s.boxShadow !== 'none';
    const hasBorder = parseFloat(s.borderTopWidth) > 0;
    return br >= 6 && (hasShadow || hasBorder) && r.width > 150 && r.height > 60;
  }).slice(0, 8).map(el => { const s = cs(el); return { bg: s.backgroundColor, borderRadius: s.borderTopLeftRadius, boxShadow: s.boxShadow, border: s.borderTop, padding: s.padding }; });
  const cseen = new Set();
  const cardUniq = cards.filter(c => { const k = c.bg + c.borderRadius + c.boxShadow; if (cseen.has(k)) return false; cseen.add(k); return true; });

  // inputs
  const inp = [...document.querySelectorAll('input[type="text"], input:not([type]), textarea, input[type="search"]')].filter(vis)[0];
  const inputStyle = inp ? pick(inp, ['backgroundColor', 'border', 'borderRadius', 'padding', 'fontSize', 'color']) : null;

  // avatars: img or div rounded
  const av = [...document.querySelectorAll('img, [class*="avatar"]')].filter(vis).map(el => { const s = cs(el); const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), borderRadius: s.borderRadius }; }).filter(a => a.w > 10 && a.w < 80).slice(0, 6);

  return JSON.stringify({ body, headingSizes, navStyle, buttons: btnUniq, cards: cardUniq, inputStyle, avatars: av }, null, 1);
})()
