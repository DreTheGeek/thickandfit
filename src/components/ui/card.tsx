import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

/**
 * Zero-border card. Surface ground with a subtle shadow.
 *
 * The `dark` variant is REMOVED, not deprecated, and it should not come back in this shape. It read
 * `bg-ink text-bg`, which is an inversion rather than a role: correct in the light palette, where
 * ink is #0f0f0f and bg is #e7e5df, and backwards inside `.tf-portal`, where ink is #ffffff and bg
 * is #000000. It rendered a white block on a black screen on /community and, because those cards
 * carried literal `text-white` copy, white-on-white on /you and /account.
 *
 * The rule it broke: `.tf-portal` re-themes anything written in ROLES for free and silently inverts
 * anything written in the two LITERAL ends of a palette. A component that needs to stand off the
 * page should name the role it wants (`bg-warm`), not assume which end is dark.
 *
 * Use `RaisedCard` from `@/components/portal/portal-chrome` for a card that must sit above the page
 * in either palette. Use an explicit dark ground only where the content is white by design, as the
 * membership and goal cards are until their screens get the 8.0 treatment.
 */
export function Card({ className = '', children, ...rest }: CardProps): ReactElement {
  return (
    <div
      className={['rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.08)]', className].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

type HeroCardProps = {
  image: string;
  /** background-position, e.g. "center 16%". */
  position?: string;
  children: ReactNode;
  className?: string;
};

/** Photo card with a black gradient overlay and bottom-aligned content. */
export function HeroCard({
  image,
  position = 'center',
  children,
  className = '',
}: HeroCardProps): ReactElement {
  return (
    <div
      className={[
        'relative flex flex-col justify-end overflow-hidden rounded-2xl p-5 text-white',
        className,
      ].join(' ')}
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(15,15,15,0.2), rgba(15,15,15,0.88)), url('${image}')`,
        backgroundSize: 'cover',
        backgroundPosition: position,
      }}
    >
      {children}
    </div>
  );
}
