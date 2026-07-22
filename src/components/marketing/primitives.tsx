// Marketing layout primitives.
//
// Sections are full-bleed with a gutter, no centred max-width container and no decorative rules.
//
// An earlier version hung everything off a 1px vertical "thread" running the page. That is gone:
// none of the 24 current landing pages measured in .planning/LANDING-TEARDOWN-2026.md uses a
// persistent vertical rule, its associations are editorial-brutalist agency portfolio, and it costs
// horizontal room at 390px where every pixel is contested.
import type { ReactElement, ReactNode } from 'react';

export type Ground = 'cream' | 'white' | 'ink';
export type Beat = 'tight' | 'normal' | 'open' | 'bleed';

// Two class hooks per ground. The Tailwind pair drives the light treatment; the tf-ground-* class
// is what the dark variant overrides in globals.css, so a whole second art direction is a token
// swap rather than a forked component tree.
const GROUND: Record<Ground, string> = {
  cream: 'tf-ground-cream bg-bg text-ink',
  white: 'tf-ground-white bg-surface text-ink',
  ink: 'tf-ground-ink tf-on-ink bg-ink text-white',
};

const BEAT: Record<Beat, string> = {
  tight: 'py-[var(--beat-tight)]',
  normal: 'py-[var(--beat-normal)]',
  open: 'py-[var(--beat-open)]',
  bleed: 'py-0',
};

/**
 * A page section. Provides the ground, the vertical beat, its own segment of the thread, and the
 * left indent that keeps every section on the same optical rail.
 */
export function Section({
  ground,
  beat,
  children,
  className = '',
  id,
}: {
  ground: Ground;
  beat: Beat;
  children: ReactNode;
  className?: string;
  id?: string;
}): ReactElement {
  return (
    <section id={id} className={`relative ${GROUND[ground]} ${BEAT[beat]} ${className}`}>
      <div
        className="relative"
        style={{ paddingLeft: 'var(--gutter)', paddingRight: 'var(--gutter)' }}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * A section opener. Small uppercase label in the accent, which is one of the three places the
 * teardown found the accent actually used on consumer pages (CTA fill, proof glyphs, eyebrows).
 */
export function Eyebrow({ label, ground = 'cream' }: { label: string; ground?: Ground }): ReactElement {
  return (
    <div className="mb-5 flex items-center">
      <span
        className={
          ground === 'ink'
            ? 'text-[12px] font-bold uppercase tracking-[0.14em] text-white/60'
            : 'tf-eyebrow-accent'
        }
      >
        {label}
      </span>
    </div>
  );
}

/**
 * The aperture. One fixed frame; the screenshot is the variable inside it.
 *
 * The four app assets are pre-baked composites of two and three phones at different scales, with
 * iOS chrome burned into the raster and alpha in the corners. Showing them as-is is what made the
 * feature rows look accidental. Cropping them to a constant frame means no source edge is ever
 * visible, so their mismatched dimensions stop mattering. No device frame, no bezel, no rounded
 * corners, no shadow, no rotation: the frame is the constant, the content is the variable.
 *
 * The white background is load-bearing, not decorative: it fills the alpha so transparent corners
 * do not leak the page ground through the plate.
 */
export function Aperture({
  src,
  alt,
  caption,
  ratio = '4 / 5',
  position = 'center',
  bleed,
}: {
  src: string;
  alt: string;
  caption: string;
  ratio?: string;
  position?: string;
  bleed?: 'left' | 'right';
}): ReactElement {
  return (
    <figure
      className={
        bleed === 'right'
          ? 'mr-[calc(var(--gutter)*-1)]'
          : bleed === 'left'
            ? 'ml-[calc(var(--gutter)*-1)]'
            : ''
      }
    >
      <div
        className="w-full overflow-hidden border border-line bg-surface"
        style={{ aspectRatio: ratio }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static marketing screenshot */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          style={{ objectPosition: position }}
        />
      </div>
      <figcaption className="mt-3 border-t border-line pt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-soft">
        {caption}
      </figcaption>
    </figure>
  );
}

/**
 * A testimonial interruption.
 *
 * The five real client reviews used to sit together in one masonry block, which is the module
 * treatment every fitness site uses and which readers skip. Redistributed between Stephanie's
 * sections instead, so her voice and theirs alternate down the page.
 *
 * Their words are set at the same ink and nearly the same size as her own body copy, never grey,
 * never italic, and the attribution is 15px rather than fine print. If the argument is that the
 * client outranks the marketing, the typography has to actually say so.
 */
export function Interruption({
  quote,
  who,
  ground,
  emphasis = false,
}: {
  quote: string;
  who: string;
  ground: Ground;
  emphasis?: boolean;
}): ReactElement {
  return (
    <Section ground={ground} beat="tight">
      <figure
        className={`max-w-[52ch] ${emphasis ? 'border-l-2 border-[var(--c-accent)] pl-6' : ''}`}
      >
        <blockquote
          className={`${emphasis ? 'text-[20px] sm:text-[22px]' : 'text-[18px] sm:text-[19px]'} leading-[1.7] ${
            ground === 'ink' ? 'text-white' : 'text-ink'
          }`}
        >
          {quote}
        </blockquote>
        <figcaption
          className={`mt-6 text-[15px] font-semibold ${ground === 'ink' ? 'text-white/70' : 'text-ink'}`}
        >
          {who}
        </figcaption>
      </figure>
    </Section>
  );
}
