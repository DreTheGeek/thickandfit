// Shared primitives for marketing direction v2.
//
// The layout grammar is Ladder's (the client's chosen reference); the paint is ours. Tokens:
//   ground #0e0e0e, raised #262626, bone #fafafa, body grey #bcbcbc, accent crimson #ff2d55
//   headings 800 weight, uppercase, line-height ~1.0
//   pills fully round, section rhythm 96 to 120px
import type { ReactElement, ReactNode } from 'react';

// Ladder's structure, Thick & Fit's paint. The only colour swap is the accent: Ladder's lime
// #e6ff00 becomes our crimson #ff2d55 (the dark-variant --c-accent, sampled from her leggings).
// Both take near-black label text, so the CTA treatment carries over unchanged.
export const TOKENS = {
  ground: '#0e0e0e',
  raised: '#262626',
  bone: '#fafafa',
  grey: '#bcbcbc',
  accent: '#ff2d55',
} as const;

/** Full-bleed section with the standard vertical rhythm. `tone` picks the ground. */
export function LSection({
  children,
  tone = 'dark',
  className = '',
  id,
}: {
  children: ReactNode;
  tone?: 'dark' | 'raised' | 'bone';
  className?: string;
  id?: string;
}): ReactElement {
  const grounds = {
    dark: 'bg-[#0e0e0e] text-white',
    raised: 'bg-[#262626] text-white',
    bone: 'bg-[#fafafa] text-[#0e0e0e]',
  };
  return (
    <section id={id} className={`${grounds[tone]} px-5 py-20 sm:px-8 lg:py-28 ${className}`}>
      <div className="mx-auto w-full max-w-[1200px]">{children}</div>
    </section>
  );
}

/** The heavy uppercase headline. Ladder sets these at 800 with ~1.0 leading. */
export function LH2({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <h2
      className={`text-[32px] font-extrabold uppercase leading-[1.02] tracking-[-0.01em] sm:text-[40px] lg:text-[48px] ${className}`}
    >
      {children}
    </h2>
  );
}

/** Body copy. Grey on dark grounds, near-black on bone. */
export function LBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <p className={`max-w-[46ch] text-[16px] leading-[1.5] sm:text-[18px] ${className}`}>{children}</p>
  );
}

/** The one CTA: a fully round lime pill with black label. */
export function LCta({
  children,
  href = '#',
  className = '',
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}): ReactElement {
  return (
    <a
      href={href}
      className={`inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-center text-[15px] font-bold uppercase tracking-[0.02em] text-[#0e0e0e] transition-opacity hover:opacity-90 ${className}`}
    >
      {children}
    </a>
  );
}

/** Small uppercase label that sits above a headline. */
export function LEyebrow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <p className={`text-[18px] font-extrabold uppercase leading-tight ${className}`}>{children}</p>
  );
}
