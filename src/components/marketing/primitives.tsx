// Marketing layout primitives.
//
// The organising idea is a single 1px vertical rule ("the thread") at a fixed viewport x, with
// every section hanging off it. It replaces the centred max-width container that every section used
// to sit in, which is what produced the dead space: content floated in the middle of a 1180px box
// while the viewport got wider around it.
//
// The thread is drawn PER SECTION rather than once for the page, because one element cannot change
// colour as it crosses a light ground into an ink one. Sections abut with no gap, so it still reads
// as one continuous line from the nav to the footer.
import type { ReactElement, ReactNode } from 'react';

export type Ground = 'cream' | 'white' | 'ink';
export type Beat = 'tight' | 'normal' | 'open' | 'bleed';

const GROUND: Record<Ground, string> = {
  cream: 'bg-bg text-ink',
  white: 'bg-surface text-ink',
  ink: 'tf-on-ink bg-ink text-white',
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
      {/* This section's segment of the thread. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 w-px"
        style={{
          left: 'var(--thread-x)',
          background: ground === 'ink' ? 'var(--c-line-d)' : 'var(--c-line)',
        }}
      />
      <div
        className="relative"
        style={{
          paddingLeft: 'calc(var(--thread-x) + var(--thread-gap))',
          paddingRight: 'var(--gutter)',
        }}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * A section opener: an 11px label sitting behind a 24px tick that crosses the thread. Replaces the
 * old rounded icon badge, which was the same shape on every section and carried no information.
 */
export function Eyebrow({ label, ground = 'cream' }: { label: string; ground?: Ground }): ReactElement {
  return (
    <div className="relative mb-6 flex items-center">
      <span
        aria-hidden="true"
        className="absolute h-px w-6"
        style={{
          left: 'calc((var(--thread-x) + var(--thread-gap)) * -1 + var(--thread-x) - 11px)',
          background: ground === 'ink' ? 'var(--c-line-d)' : 'var(--c-line)',
        }}
      />
      <span
        className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
          ground === 'ink' ? 'text-white/55' : 'text-soft'
        }`}
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
      {/* Emphasis as a structural event: the thread itself thickens for the height of this quote,
          rather than adding an ornament next to it. */}
      {emphasis ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-[3px]"
          style={{
            left: 'calc(var(--thread-x) - 1px)',
            background: ground === 'ink' ? 'var(--c-line-d)' : 'var(--c-ink)',
          }}
        />
      ) : null}
      <figure className="max-w-[52ch]">
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
