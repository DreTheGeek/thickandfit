// Social proof, start-today pitch, FAQ and footer for the Thick & Fit landing page.
//
// The LAYOUT is a structural clone of joinladder.com (measured 2026-07-22). Every line of copy,
// every colour token and every asset below is ours: real client quotes, real pricing, real tiers.
// The only colour change from the reference is the accent, lime #e6ff00 becomes crimson #ff2d55.
import type { ReactElement } from 'react';
import { headers } from 'next/headers';
import Link from 'next/link';

import { LCta, LH2, LSection } from '@/components/marketing/v2/ui';
import { withLocalePrefix } from '@/lib/seo/locale-alternates';

type Review = { quote: string; who: string };

const REVIEWS: readonly Review[] = [
  {
    quote:
      'This program really pushed me. I worked out on a regular basis before, but felt like I was just going through the motions. After starting this program, I am excited about fitness again and I feel stronger than I have ever felt.',
    who: 'Minta T.',
  },
  {
    quote:
      'Everything is great about this program. I got out of my comfort zone, I have changed myself, and I have done exercises I thought I would struggle with. Everything is well explained, love it.',
    who: 'Guadalupe U.',
  },
  {
    quote:
      'Love the workouts and energy vibes with the community groups. Coach Steph engages with her clients daily. I am down 5 lbs and keeping focus toward my goal.',
    who: 'Rowena B.',
  },
  {
    quote:
      'I stopped taking progress photos because I hated them. Now I take them every week and I actually want to look.',
    who: 'Zakeya M.',
  },
  {
    quote:
      'Being able to write to her team in Spanish changed everything for me. I finally understand my own plan.',
    who: 'Carolina R.',
  },
];

const STARS: readonly number[] = [0, 1, 2, 3, 4];

/** The wall of client quotes. Five real cards in a three-up grid. */
export function Testimonials(): ReactElement {
  return (
    <LSection tone="dark">
      <p className="mb-10 text-center text-[14px] font-bold uppercase tracking-widest text-white">
        In their words
      </p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {REVIEWS.map((review) => (
          <article key={review.who} className="rounded-xl bg-[#262626] p-6">
            <div className="flex gap-[2px]" aria-label="5 out of 5 stars">
              {STARS.map((star) => (
                <span key={star} aria-hidden className="text-[13px] text-[#ff2d55]">
                  &#9733;
                </span>
              ))}
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-[#bcbcbc]">{review.quote}</p>
            <p className="mt-4 text-[13px] text-white/50">{review.who}</p>
          </article>
        ))}
      </div>
    </LSection>
  );
}

/** The start-today pitch: a two line headline with the second line in crimson, then the CTA. */
export function StartToday(): ReactElement {
  return (
    <LSection tone="dark">
      <LH2 className="text-center">
        Start today,
        <br />
        <span className="text-[#ff2d55]">cancel anytime.</span>
      </LH2>
      <LCta href="/join" className="mx-auto mt-8 block w-fit">
        Start today
      </LCta>
    </LSection>
  );
}

type Faq = { q: string; a: string };

const FAQS: readonly Faq[] = [
  {
    q: 'What is Thick & Fit?',
    a: "Coach Stephanie Pantoja's coaching method for women, in English and Spanish. She writes and films the training, takes the guessing out of the food, and her team stays in your corner while you build the habit.",
  },
  {
    q: 'Is Thick & Fit available in Spanish?',
    a: 'Yes. Every screen reads fully in Spanish or English, and you choose your language when you join. Write to her team in the language you actually think in.',
  },
  {
    q: 'How much does it cost?',
    a: 'Foundation is $19.97 a month. Coached membership, where Steph and her team work with you directly, starts at $200 a month.',
  },
  {
    q: 'Is there a free trial?',
    a: 'No free trial, but no contract either. Cancel anytime and you are never locked in, and you keep any free resources you picked up along the way.',
  },
  {
    q: 'How does the food photo tracking work?',
    a: "You photograph your plate and it reads what is on it and how much, cooked or raw. No scale, no database searching, no guessing at your abuela's cooking.",
  },
];

/** The FAQ block on the bone ground. Native details/summary, no client JS. */
export function Faq(): ReactElement {
  return (
    <LSection tone="bone">
      <LH2 className="mb-8 text-[#0e0e0e]">Still have questions?</LH2>
      <div>
        {FAQS.map((faq) => (
          <details key={faq.q} className="border-b border-black/10 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[17px] font-bold text-[#0e0e0e] [&::-webkit-details-marker]:hidden">
              {faq.q}
              <span aria-hidden className="ml-4 shrink-0 text-[20px] font-bold">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-[70ch] text-[15px] text-[#4a4a4a]">{faq.a}</p>
          </details>
        ))}
      </div>
    </LSection>
  );
}

type FooterLink = { label: string; href: string };

// Programs are the three pricing tiers, so they point at the pricing page (there is no per-tier
// route). Pages and legal point at their real routes; About/Pricing/FAQ have Spanish twins.
const PAGE_LINKS: readonly FooterLink[] = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '/faq' },
  { label: 'About', href: '/about' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];
const PROGRAM_LINKS: readonly FooterLink[] = [
  { label: 'Foundation', href: '/pricing' },
  { label: 'Evolution', href: '/pricing' },
  { label: 'Elite', href: '/pricing' },
];

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: readonly FooterLink[];
}): ReactElement {
  return (
    <div>
      <h3 className="text-[14px] font-bold uppercase text-white">{heading}</h3>
      <div className="mt-4 flex flex-col gap-2">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-[14px] text-[#bcbcbc] hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Four column footer with the trial CTA and the legal strip. Links resolve to real routes, kept in
 *  the visitor's language where a Spanish twin exists. */
export async function SiteFooter(): Promise<ReactElement> {
  const pathname = (await headers()).get('x-pathname');
  const lp = (target: string): string => withLocalePrefix(pathname, target);
  const withLocale = (links: readonly FooterLink[]): FooterLink[] =>
    links.map((l) => ({ label: l.label, href: lp(l.href) }));

  return (
    <footer className="bg-[#0e0e0e] px-5 py-16 text-white sm:px-8">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href={lp('/')} aria-label="Thick &amp; Fit" className="inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-white.svg" alt="Thick &amp; Fit" className="h-5 w-auto" />
            </Link>
            <p className="mt-4 text-[14px] text-[#bcbcbc]">
              The system that turns starting over into staying.
            </p>
          </div>
          <FooterColumn heading="Pages" links={withLocale(PAGE_LINKS)} />
          <FooterColumn heading="Programs" links={withLocale(PROGRAM_LINKS)} />
          <div>
            <h3 className="text-[14px] font-bold uppercase text-white">Get started</h3>
            <LCta href="/join" className="mt-4 block w-fit">
              Start today
            </LCta>
            <p className="mt-3 text-[13px] text-[#bcbcbc]">Cancel anytime, no contract.</p>
          </div>
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-[13px] text-white/50">&copy; 2026 Thick Fit Coaching LLC</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="text-[13px] text-white/50 hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="text-[13px] text-white/50 hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
