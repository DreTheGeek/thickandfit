(() => {
  const out = {};
  // sidebar: sample the leftmost column at several y
  const pts = [[28, 90], [28, 300], [28, 500], [28, 800]];
  out.sidebarSamples = pts.map(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    let e = el, chain = [];
    for (let i = 0; i < 4 && e; i++) { const c = getComputedStyle(e); chain.push(c.backgroundColor); e = e.parentElement; }
    return { y, tag: el.tagName, bgChain: chain };
  });
  // accent green used in charts/badges: scan svg path strokes and elements with greenish bg
  const greens = new Set();
  document.querySelectorAll('svg path, svg rect, svg circle').forEach(p => {
    const s = getComputedStyle(p);
    if (s.stroke && s.stroke !== 'none') greens.add('stroke:' + s.stroke);
    if (s.fill && s.fill !== 'none' && s.fill !== 'rgb(0, 0, 0)') greens.add('fill:' + s.fill);
  });
  out.svgColors = [...greens].slice(0, 25);
  // intercom present
  out.intercom = !!document.querySelector('.intercom-lightweight-app, [class*="intercom"], iframe[name*="intercom"]');
  // any pill/badge bg colors
  const badges = new Set();
  document.querySelectorAll('[class*="badge"],[class*="pill"],[class*="tag"],[class*="chip"]').forEach(b => {
    const s = getComputedStyle(b);
    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') badges.add(s.backgroundColor + ' / ' + s.color);
  });
  out.badges = [...badges].slice(0, 15);
  return JSON.stringify(out, null, 1);
})()
