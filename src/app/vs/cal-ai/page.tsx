// Comparison page: Thick & Fit vs Cal AI. Second of the /vs set (order per
// .planning/MARKETING-AUDIENCE.md: MyFitnessPal -> Cal AI -> Fitia -> Lenus).
//
// ANGLE (from the research): photo-only calorie apps collapse on mixed, saucy, regional dishes,
// which is exactly Latin home cooking. Our wedge is HONESTY: we do not claim "90% on everything"
// (the exact over-claim that got photo apps ridiculed); we ground every food in verified data,
// convert cooked/raw, and are a coaching system, not a one-trick scanner.
//
// CLAIM DISCIPLINE:
//   - Every "Thick & Fit" line is verified against the code (grounded USDA + Open Food Facts,
//     cooked_uncooked_ratios, smart-scan/barcode/text, shipped workouts/coach/community).
//   - The Cal AI column stays on category-documented, defensible facts: it is a photo-estimation
//     app; photo portion estimation is unreliable on mixed/regional meals; short trial. No
//     unverified ownership claim, no invented specifics.
//   - BRAND RULE: our scan is "Stephanie's method, automated" - never called "AI" in copy. "Cal AI"
//     appears only as the competitor's registered product name, which is the search term itself.
//
// CLAIM CORRECTIONS, 2026-08-04, verified against calai.app itself before writing:
//   - Accuracy. The old row said they make "big promises". Their own site says "CalAI is about 80%
//     accurate. No food tracking app is perfect", which is a hedge, not a promise, so the row was
//     both unbackable and wrong. It now quotes their published number and contrasts the SOURCE of
//     ours: verified data, not an estimate off a depth reading.
//   - The trial. The old row called it "short, easy to forget". Ours is also three days, so that was
//     hypocrisy on top of a characterization. Their site says "CLAIM YOUR 3-DAY FREE TRIAL" and
//     "Cancel anytime", so the row states the length and the renewal, both checkable.
//   - Cooked vs raw. "Not handled" is a negative we cannot prove about someone else's product. The
//     row now describes who does the work, and scopes OUR side to what actually ships: meats, rice
//     and beans.
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/v2/shell';
import { LSection, LH2, LBody, LEyebrow } from '@/components/marketing/v2/ui';
import { Icon } from '@/components/ui/icons';
import { JsonLd } from '@/components/seo/json-ld';
import { graph, faqPageNode, breadcrumbNode, type JsonLdNode } from '@/lib/seo/schema';
import { configuredTrialDays } from '@/lib/billing/trial-shared';

export const dynamic = 'force-dynamic';

const TITLE = 'Cal AI alternative that gets Latin food right | Thick & Fit';
const DESCRIPTION =
  'A photo alone is a guess, and it guesses worst on mixed, saucy, home-cooked Latin dishes. Thick ' +
  '& Fit grounds every food in verified data, converts meats, rice and beans from cooked back to ' +
  'raw, in English and Spanish, with workouts and a real coach behind it.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: '/vs/cal-ai',
      languages: { en: '/vs/cal-ai', es: '/es/vs/cal-ai', 'x-default': '/vs/cal-ai' },
    },
    openGraph: {
      url: '/vs/cal-ai',
      title: TITLE,
      description: DESCRIPTION,
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

type Row = { label: string; them: string; us: string };
const ROWS: readonly Row[] = [
  { label: 'How it works', them: 'A photo, then an estimate', us: 'A photo, grounded in verified data' },
  { label: 'Mixed and saucy dishes', them: 'Where photo estimates break down', us: 'Read component by component' },
  { label: 'Cooked vs raw', them: 'You do the conversion', us: 'Meats, rice and beans, converted for you' },
  { label: 'Latin home cooking', them: 'Not what it was built for', us: 'Built for your food, in Spanish' },
  { label: 'More than a number', them: 'Just a counter', us: 'Workouts, a coach, and a community' },
  { label: 'Accuracy', them: 'About 80%, by their own published number', us: 'Verified data behind the grams, not a guess' },
  { label: 'Signing up', them: '3 days free, then it renews on its own', us: 'Price shown first, cancel in one tap, no auto-renew surprise' },
];

const FAQ: readonly { question: string; answer: string }[] = [
  {
    question: 'Are photo calorie apps accurate?',
    answer:
      'For a plain, single food, a photo estimate can be close. For real meals, mixed plates, sauces ' +
      'and home cooking, photo estimation gets much less reliable, because a camera cannot see oil, ' +
      'portion depth or what is underneath. That is exactly the food most people actually eat.',
  },
  {
    question: 'How is Thick & Fit more accurate than a photo scanner?',
    answer:
      "Thick & Fit uses a photo to identify the food and the portion, then pulls the macros from " +
      'validated sources (USDA FoodData Central and Open Food Facts) rather than guessing the numbers. ' +
      'On meats, rice and beans it also converts the cooked weight back to raw, which is where the ' +
      'biggest errors hide. We do not claim to be perfect on everything, we claim to be right on the ' +
      'food you actually eat.',
  },
  {
    question: 'Does it handle Latin dishes and cooked vs raw?',
    answer:
      'Yes. Thick & Fit is built to read Latin home cooking such as arroz con pollo, tamales, arepas ' +
      'and pupusas, in Spanish. Cooked-to-raw conversion covers meats, rice and beans today, the three ' +
      'that move your numbers the most, and that list grows as Stephanie adds more of her foods to it.',
  },
  {
    question: 'Is this just another calorie scanner?',
    answer:
      'No. Scanning your food is one feature. Thick & Fit is a coaching system: nutrition, workouts ' +
      "with filmed demos built around the equipment you have, a coach in Stephanie's voice, a " +
      'community, and a transformation timeline. A scanner cannot hold you accountable. A coach can.',
  },
  {
    question: 'Can I cancel easily?',
    answer:
      'Yes. The price is shown before you ever pay, there is no contract, and you can cancel in one ' +
      'tap from inside the app, with no hidden steps and no phone call. You keep access through the ' +
      'end of the period you already paid for.',
  },
];

function Cell({ children, kind }: { children: string; kind: 'them' | 'us' }): ReactElement {
  return (
    <td className="border-t border-white/10 px-4 py-4 align-top text-[14px] sm:text-[15px]">
      <span className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 ${kind === 'us' ? 'text-[#ff2d55]' : 'text-white/30'}`}>
          <Icon name={kind === 'us' ? 'check' : 'minus'} size={16} strokeWidth={2.5} />
        </span>
        <span className={kind === 'us' ? 'font-semibold text-white' : 'text-white/60'}>{children}</span>
      </span>
    </td>
  );
}

/**
 * Sibling links. Nothing in the nav or footer points into the /vs cluster yet, so the three pages
 * link to each other and to their Spanish twin: once the sitemap gets a crawler to any one of them,
 * the other five are reachable by following links, which is what indexing actually needs.
 */
function MoreComparisons(): ReactElement {
  const links: readonly { href: string; label: string }[] = [
    { href: '/vs/myfitnesspal', label: 'Thick & Fit vs MyFitnessPal' },
    { href: '/vs/fitia', label: 'Thick & Fit vs Fitia' },
    { href: '/es/vs/cal-ai', label: 'Esta página en español' },
  ];
  return (
    <LSection tone="raised">
      <LEyebrow className="text-white">Keep looking</LEyebrow>
      <LH2 className="mt-1 text-white">Compare the rest</LH2>
      <div className="mt-8 flex flex-wrap gap-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border border-white/20 px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:border-white/50"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </LSection>
  );
}

export default function VsCalAiPage(): ReactElement {
  // The CTA goes to /join, the waitlist, and there is no trial configured unless STRIPE_TRIAL_DAYS
  // is set — so "Start 3 days free" was advertising an offer the product would not have honoured.
  // Reads the same value the checkout call sends, so the sentence and the offer turn on together.
  const trial = configuredTrialDays();
  const ctaLabel = trial > 0 ? `Start ${trial} days free` : 'Join the waitlist';
  const nodes = [
    faqPageNode([...FAQ]),
    breadcrumbNode([
      { name: 'Home', path: '/' },
      { name: 'Thick & Fit vs Cal AI', path: '/vs/cal-ai' },
    ]),
  ].filter((n): n is JsonLdNode => n !== null);

  return (
    <MarketingShell>
      <JsonLd data={graph(nodes)} />

      {/* Hero */}
      <section className="border-b border-white/10 bg-[#0e0e0e] px-5 pb-16 pt-20 sm:px-8 lg:pb-24 lg:pt-28">
        <div className="mx-auto w-full max-w-[1000px] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/45">
            Thick &amp; Fit vs Cal AI
          </p>
          <h1 className="mx-auto mt-4 max-w-[15ch] text-[40px] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] text-white sm:text-[56px] lg:text-[64px]">
            A photo is a guess. We make it right.
          </h1>
          <p className="mx-auto mt-6 max-w-[54ch] text-[17px] leading-[1.5] text-white/75 sm:text-[19px]">
            Snap-a-photo apps guess worst on the food you actually eat: mixed plates, sauces, your
            mom&apos;s cooking. Thick &amp; Fit grounds the number in real data, converts your meats,
            rice and beans back to raw, and puts a coach behind it.
          </p>
          <div className="mt-8">
            <Link
              href="/join"
              className="inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              {ctaLabel}
            </Link>
            <p className="mt-3 text-[13px] text-white/50">Cancel any time, one tap.</p>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <LSection tone="dark">
        <LH2 className="text-center text-white">Side by side</LH2>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr>
                <th className="w-[26%] px-4 pb-3" />
                <th className="px-4 pb-3 text-[13px] font-bold uppercase tracking-[0.1em] text-white/55">
                  Cal AI
                </th>
                <th className="px-4 pb-3 text-[13px] font-bold uppercase tracking-[0.1em] text-[#ff2d55]">
                  Thick &amp; Fit
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="border-t border-white/10 px-4 py-4 align-top text-[13px] font-semibold uppercase tracking-[0.06em] text-white/50">
                    {row.label}
                  </td>
                  <Cell kind="them">{row.them}</Cell>
                  <Cell kind="us">{row.us}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LSection>

      {/* A photo alone is a guess */}
      <LSection tone="bone">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <LEyebrow className="text-[#0e0e0e]">Accuracy, honestly</LEyebrow>
            <LH2 className="mt-1 text-[#0e0e0e]">A camera can&apos;t see the oil</LH2>
            <LBody className="mt-5 text-[#4a4a4a]">
              It cannot see the butter under the rice or how deep the bowl is. So a photo-only app
              guesses, and it guesses worst on the mixed, home-cooked plates that make up most of your
              week. Thick &amp; Fit uses the photo to know what and how much, then pulls the real
              numbers from validated data and converts your meats, rice and beans back to raw. Honest
              beats impressive.
            </LBody>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shoot/atlanta-profile.avif"
            alt="Stephanie Pantoja"
            className="aspect-[4/5] w-full rounded-xl object-cover object-[center_20%]"
          />
        </div>
      </LSection>

      {/* Her method, not a gimmick */}
      <LSection tone="dark">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shoot/deadlift.avif"
            alt="Stephanie Pantoja"
            className="aspect-[4/5] w-full rounded-xl object-cover object-[center_30%] lg:order-2"
          />
          <div className="lg:order-1">
            <LEyebrow className="text-white">More than a scan</LEyebrow>
            <LH2 className="mt-1 text-white">A scanner can&apos;t coach you</LH2>
            <LBody className="mt-5 text-[#bcbcbc]">
              Counting a meal has never changed anyone by itself. Thick &amp; Fit is Stephanie&apos;s
              method, working for you every day: workouts built around the equipment you have, her
              team in your corner, a community that notices when you go quiet, and a timeline that
              shows you changing. The number is the start, not the whole thing.
            </LBody>
            <Link
              href="/join"
              className="mt-8 inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </LSection>

      <MoreComparisons />

      {/* FAQ */}
      <LSection tone="dark" id="faq">
        <LH2 className="text-white">Questions</LH2>
        <div className="mt-8 divide-y divide-white/10 border-t border-white/10">
          {FAQ.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold text-white">
                {item.question}
                <span className="shrink-0 text-white/40 transition-transform group-open:rotate-45">
                  <Icon name="plus" size={20} />
                </span>
              </summary>
              <p className="mt-3 max-w-[70ch] text-[15px] leading-[1.6] text-[#bcbcbc]">{item.answer}</p>
            </details>
          ))}
        </div>
      </LSection>

      {/* Close */}
      <LSection tone="raised">
        <div className="text-center">
          <LH2 className="text-white">
            Stop guessing.
            <br />
            <span className="text-[#ff2d55]">Start knowing.</span>
          </LH2>
          <div className="mt-8">
            <Link
              href="/join"
              className="inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              {ctaLabel}
            </Link>
            <p className="mt-3 text-[13px] text-white/50">
              $19.97 a month founding price, $24.97 after the founding window.
              Cancel any time, one tap.
            </p>
          </div>
        </div>
      </LSection>
    </MarketingShell>
  );
}
