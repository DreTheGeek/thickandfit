import Script from "next/script";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CoachingShowcase } from "@/components/marketing/coaching-showcase";

// Landing page = the lifted Webflow site. Its body scripts (interactions, the lead
// funnel/quiz) load HERE ONLY, never in the root layout, so they don't inject the
// marketing quiz onto auth/app pages.
const bodyHtml = readFileSync(resolve(process.cwd(), "src/app/_body.html"), "utf8");

// Split the blob around the "#coaching" section so we can show the Webflow version on
// phone/tablet (perfect as-is) and a native, responsive rebuild on desktop. Server-side
// (no JS), so it's reliable. Falls back to the whole blob if the markers aren't found.
function splitAtCoaching(html: string): { before: string; section: string; after: string } | null {
  const marker = html.indexOf('id="coaching"');
  if (marker === -1) return null;
  const start = html.lastIndexOf("<section", marker);
  const endTag = html.indexOf("</section>", marker);
  if (start === -1 || endTag === -1) return null;
  const end = endTag + "</section>".length;
  return { before: html.slice(0, start), section: html.slice(start, end), after: html.slice(end) };
}
const parts = splitAtCoaching(bodyHtml);

type ExtractedScript = { src: string | null; type: string | null; inline: string | null };
type ScriptsManifest = { head: ExtractedScript[]; body: ExtractedScript[] };

const scriptsManifest: ScriptsManifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/app/_scripts.json"), "utf8"),
);

const isVwoInline = (s: ExtractedScript): boolean =>
  s.inline != null && s.inline.includes("_vwo_code");

const isWModDetector = (s: ExtractedScript): boolean =>
  s.inline != null && s.inline.includes("w-mod-") && s.inline.includes("documentElement");

const bodyScripts = scriptsManifest.body.filter((s) => !isVwoInline(s) && !isWModDetector(s));

export default function Home() {
  return (
    <>
      {/* Webflow CSS loads ONLY on the landing page so it never restyles the app/auth UI. */}
      <link rel="stylesheet" href="/assets/css/webflow.css" />
      {parts ? (
        <>
          <div dangerouslySetInnerHTML={{ __html: parts.before }} />
          {/* Webflow coaching showcase: phone/tablet only (mobile stays exactly as-is). */}
          <div className="lg:hidden" dangerouslySetInnerHTML={{ __html: parts.section }} />
          {/* Native rebuild of the coaching showcase: desktop only. */}
          <div className="hidden lg:block">
            <CoachingShowcase />
          </div>
          <div dangerouslySetInnerHTML={{ __html: parts.after }} />
        </>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      )}
      {bodyScripts.map((s, idx) => {
        if (s.src != null) {
          return (
            <Script
              key={`s-${idx}`}
              src={s.src}
              strategy="afterInteractive"
              type={s.type ?? undefined}
            />
          );
        }
        if (s.inline != null) {
          return (
            <Script
              key={`s-${idx}`}
              id={`inline-script-${idx}`}
              strategy="afterInteractive"
              type={s.type ?? undefined}
              dangerouslySetInnerHTML={{ __html: s.inline }}
            />
          );
        }
        return null;
      })}
    </>
  );
}
