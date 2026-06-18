import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "./globals.css";
import { SwRegister } from "@/components/pwa/sw-register";
import { IOSInstallBanner } from "@/components/pwa/ios-install-banner";
import { AndroidInstallButton } from "@/components/pwa/android-install-button";

const gulamsCondensed = localFont({
  src: "../../public/assets/fonts/a0274ead7b73.woff2",
  display: "swap",
  variable: "--font-gulams",
  weight: "600",
  style: "normal",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://thickandfitcoaching.com"),
  title: "Helping Women Fall In Love With The Journey - Thick & Fit Fitness",
  description:
    "Fitness coaching for women who want lasting results. Get custom workout programming, personalized meal plans, daily accountability, and a supportive fitness community designed to help you fall in love with the journey, not just the goal.",
  openGraph: {
    title: "Helping Women Get Curves | Thick & Fit Fitness",
    description:
      "Ready for a real fitness transformation? Thick & Fit Fitness empowers women with tailored workouts, macro-based meal plans, habit tracking, and 1:1 support so you can build strength, confidence, and sustainable results that fit your lifestyle.",
    images: ["/assets/images/open-graph.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Helping Women Get Curves | Thick & Fit Fitness",
    description:
      "Ready for a real fitness transformation? Thick & Fit Fitness empowers women with tailored workouts, macro-based meal plans, habit tracking, and 1:1 support so you can build strength, confidence, and sustainable results that fit your lifestyle.",
  },
  icons: {
    icon: "/assets/images/favicon.jpg",
    apple: "/assets/images/apple-touch-icon.jpg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Thick & Fit",
  },
};

type ExtractedScript = { src: string | null; type: string | null; inline: string | null };
type ScriptsManifest = { head: ExtractedScript[]; body: ExtractedScript[] };

const scriptsManifest: ScriptsManifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/app/_scripts.json"), "utf8"),
);

const jsonLd = scriptsManifest.head.find((s) => s.type === "application/ld+json")?.inline;

const isVwoInline = (s: ExtractedScript): boolean =>
  s.inline != null && s.inline.includes("_vwo_code");

const isWModDetector = (s: ExtractedScript): boolean =>
  s.inline != null && s.inline.includes("w-mod-") && s.inline.includes("documentElement");

const bodyScripts = scriptsManifest.body.filter((s) => !isVwoInline(s) && !isWModDetector(s));

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US" className={`w-mod-js ${gulamsCondensed.variable}`}>
      <head>
        <link rel="stylesheet" href="/assets/css/webflow.css" />
        {jsonLd != null && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLd }}
          />
        )}
      </head>
      <body>
        {children}
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
        <SwRegister />
        <IOSInstallBanner />
        <AndroidInstallButton />
      </body>
    </html>
  );
}
