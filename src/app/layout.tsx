import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
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
import { isPublicMarketingPath } from "@/lib/seo/locale-alternates";

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

// One source of truth for the public origin, shared with robots.ts + sitemap.ts + email/shell.ts +
// seo/schema.ts. Post-DNS-cutover the fallback matches prod so canonicals + OG resolve even if the
// env var is momentarily missing on a fresh preview. Override with NEXT_PUBLIC_SITE_URL for any
// non-www surface (e.g. app.teamthickandfit.com if ever attached back).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.teamthickandfit.com";

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

// The legacy Webflow JSON-LD in _scripts.json is NOT injected any more. It was still being stamped
// into the head of every page and it actively lied on our behalf:
//   - a FAQPage saying the plan runs in "4, 8 and 12 month" terms and that cancelling "requires a
//     30-day notice", while the visible pricing copy promises cancelling takes one tap. Answer
//     engines read the structured data, so we were telling ChatGPT the opposite of the page.
//   - AggregateRating 5/5 from 3 reviews stamped on every route, including pages with no visible
//     reviews at all, which is a Google structured-data policy violation and a manual-action risk.
//   - url pointing at thick-and-fit-fitness.com, a domain this build does not serve.
// Per-page schema now comes from src/lib/seo/schema.ts, which is generated from the copy that is
// actually on the page. Keep _scripts.json around only as the archive of the original site.

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
  const allMessages = await getMessages();
  // Per-request script nonce from the proxy CSP. Reading headers() also opts the tree into dynamic
  // rendering, which is required for the nonce to be stamped at SSR time.
  const reqHeaders = await headers();
  const nonce = reqHeaders.get("x-nonce") ?? undefined;

  // Public pages do not ship the app string catalog. NextIntlClientProvider serialises whatever it
  // is given into the HTML, so every anonymous visitor to a marketing page was downloading ~65KB of
  // coach, admin and operator strings: roughly 40 percent of the document. That is wasted bytes on
  // the pages most likely to be opened on a phone over mobile data, and it published the app's
  // internal vocabulary (internal record labels, role names, tooling terms) to anyone who viewed
  // source. None of these routes reference the `app` namespace, verified before removing it.
  const messages = isPublicMarketingPath(reqHeaders.get("x-pathname"))
    ? Object.fromEntries(Object.entries(allMessages).filter(([ns]) => ns !== "app"))
    : allMessages;
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`w-mod-js ${gulamsCondensed.variable} ${inter.variable}`}
    >
      <head>
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
          {/* Inside the intl provider: these use useTranslations, so they must have its context. */}
          <IOSInstallBanner />
          <AndroidInstallButton />
        </NextIntlClientProvider>
        <SwRegister />
      </body>
    </html>
  );
}
