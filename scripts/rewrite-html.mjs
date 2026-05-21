// One-time HTML transform: rewrite Webflow CDN URLs to local /assets paths,
// strip platform-specific scripts that don't belong in the Next.js rebuild.
// Reads _capture_raw.html, writes src/app/_body.html (body innerHTML only).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const captureDir = "C:/Users/dre/.claude-browser/2026-05-21T18-53-36-clone-website";

const map = JSON.parse(readFileSync(`${captureDir}/resources/resource-map.json`, "utf8"));

const urlToLocal = new Map();
for (const r of map.resources) {
  if (!r.file) continue;
  const localName = basename(r.file);
  let dir = "images";
  if (r.kind === "fonts") dir = "fonts";
  else if (r.kind === "scripts") dir = "scripts";
  else if (r.kind === "data") dir = "data";
  urlToLocal.set(r.url, `/assets/${dir}/${localName}`);

  try {
    const decoded = decodeURIComponent(r.url);
    if (decoded !== r.url) urlToLocal.set(decoded, `/assets/${dir}/${localName}`);
  } catch {}
}

let html = readFileSync(`${root}/_capture_raw.html`, "utf8");

// STRIP FIRST — analytics + tracking only. Keep jQuery, Webflow JS, Swiper,
// Lenus form, and cookie consent (visual UI). Those drive animations and
// existing functionality we need for pixel parity.
const stripPatterns = [
  /<script[^>]*src="[^"]*clarity[^"]*"[^>]*><\/script>/g,
  /<script[^>]*src="[^"]*visualwebsiteoptimizer[^"]*"[^>]*><\/script>/g,
  /<script[^>]*src="[^"]*\.vwo\.[^"]*"[^>]*><\/script>/g,
  /<script[^>]*src="[^"]*googletagmanager[^"]*"[^>]*><\/script>/g,
  /<noscript>[\s\S]*?googletagmanager[\s\S]*?<\/noscript>/g,
];
let stripped = 0;
for (const re of stripPatterns) {
  const m = html.match(re);
  if (m) stripped += m.length;
  html = html.replace(re, "");
}

let imageRewrites = 0;
let fontRewrites = 0;
let scriptRewrites = 0;

for (const [url, local] of urlToLocal) {
  if (!html.includes(url)) continue;
  html = html.split(url).join(local);
  if (local.includes("/images/")) imageRewrites++;
  else if (local.includes("/fonts/")) fontRewrites++;
  else if (local.includes("/scripts/")) scriptRewrites++;
}

const webflowCssUrl =
  "https://cdn.prod.website-files.com/690cbb3a200946ac998a67f7/css/thick-and-fit.webflow.shared.179315af1.min.css";
html = html.split(webflowCssUrl).join("/assets/css/webflow.css");

const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
if (!bodyMatch) throw new Error("could not find <body>");
let bodyInner = bodyMatch[1].trim();

const bodyAttrMatch = html.match(/<body([^>]*)>/);
const bodyAttrs = bodyAttrMatch ? bodyAttrMatch[1].trim() : "";

// React's dangerouslySetInnerHTML won't execute embedded scripts. Extract them
// from the body so layout.tsx can re-add them via next/script (in order).
const scripts = [];
bodyInner = bodyInner.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (_m, attrs, inner) => {
  const srcMatch = attrs.match(/src="([^"]+)"/);
  const typeMatch = attrs.match(/type="([^"]+)"/);
  scripts.push({
    src: srcMatch ? srcMatch[1] : null,
    type: typeMatch ? typeMatch[1] : null,
    inline: srcMatch ? null : inner.trim(),
  });
  return "";
});

// Also extract head scripts so we can preserve init order + JSON-LD.
const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/);
const headInner = headMatch ? headMatch[1] : "";
const headScripts = [];
headInner.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (_m, attrs, inner) => {
  const srcMatch = attrs.match(/src="([^"]+)"/);
  const typeMatch = attrs.match(/type="([^"]+)"/);
  headScripts.push({
    src: srcMatch ? srcMatch[1] : null,
    type: typeMatch ? typeMatch[1] : null,
    inline: srcMatch ? null : inner.trim(),
  });
  return "";
});

writeFileSync(`${root}/src/app/_body.html`, bodyInner, "utf8");
writeFileSync(`${root}/src/app/_body-attrs.txt`, bodyAttrs, "utf8");
writeFileSync(`${root}/src/app/_scripts.json`, JSON.stringify({ head: headScripts, body: scripts }, null, 2), "utf8");

console.log(`url rewrites: images=${imageRewrites} fonts=${fontRewrites} scripts=${scriptRewrites}`);
console.log(`scripts stripped (analytics): ${stripped}`);
console.log(`scripts extracted from body: ${scripts.length}`);
console.log(`scripts extracted from head: ${headScripts.length}`);
console.log(`body size after script extraction: ${(bodyInner.length / 1024).toFixed(1)}KB`);
console.log(`body attrs: ${bodyAttrs || "(none)"}`);
