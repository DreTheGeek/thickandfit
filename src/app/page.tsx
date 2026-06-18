import Script from "next/script";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Landing page = the lifted Webflow site. Its body scripts (interactions, the lead
// funnel/quiz) load HERE ONLY, never in the root layout, so they don't inject the
// marketing quiz onto auth/app pages.
const bodyHtml = readFileSync(resolve(process.cwd(), "src/app/_body.html"), "utf8");

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
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
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
