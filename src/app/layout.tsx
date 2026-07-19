import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "./globals.css";
import { SwRegister } from "@/components/pwa/sw-register";
import { IOSInstallBanner } from "@/components/pwa/ios-install-banner";
import { AndroidInstallButton } from "@/components/pwa/android-install-button";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { Suspense } from "react";
import { PostHogPageview } from "@/lib/monitoring/posthog-pageview";

const gulamsCondensed = localFont({
  src: "../../public/assets/fonts/a0274ead7b73.woff2",
  display: "swap",
  variable: "--font-gulams",
  weight: "600",
  style: "normal",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

// One source of truth for the public origin, shared with robots.ts + sitemap.ts. Override with
// NEXT_PUBLIC_SITE_URL at the teamthickandfit.com cutover; the default is the domain that serves
// this build today (so canonicals resolve and OG images load right now).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thicknfit.kaldrtech.com";

// <=165 chars so search engines show it whole (was 237, truncated in results).
const SITE_DESCRIPTION =
  "Fitness coaching for women: custom workouts, macro-based meal plans, daily accountability, and a real community. Fall in love with the journey.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Helping Women Fall In Love With The Journey - Thick & Fit Fitness",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Helping Women Get Curves | Thick & Fit Fitness",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Thick & Fit",
    images: ["/assets/images/open-graph.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Helping Women Get Curves | Thick & Fit Fitness",
    description: SITE_DESCRIPTION,
    images: ["/assets/images/open-graph.jpg"],
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

// Organization + WebSite schema with published/modified dates: answer engines (Google AI, Perplexity)
// weight dated, authored sources. Bump SITE_MODIFIED on a substantive public-content change.
const SITE_PUBLISHED = "2026-06-18";
const SITE_MODIFIED = "2026-07-19";
const orgSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Thick & Fit",
      url: SITE_URL,
      logo: `${SITE_URL}/assets/images/open-graph.jpg`,
      founder: { "@type": "Person", name: "Stephanie Pantoja" },
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Thick & Fit",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: ["en", "es"],
      datePublished: SITE_PUBLISHED,
      dateModified: SITE_MODIFIED,
    },
  ],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Per-request script nonce from the proxy CSP. Reading headers() also opts the tree into dynamic
  // rendering, which is required for the nonce to be stamped at SSR time.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`w-mod-js ${gulamsCondensed.variable} ${inter.variable}`}
    >
      <head>
        {jsonLd != null && (
          <script
            type="application/ld+json"
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: jsonLd }}
          />
        )}
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: orgSchema }}
        />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers nonce={nonce}>
            <Suspense fallback={null}>
              <PostHogPageview />
            </Suspense>
            {children}
          </Providers>
        </NextIntlClientProvider>
        <SwRegister />
        <IOSInstallBanner />
        <AndroidInstallButton />
      </body>
    </html>
  );
}
