import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

type CardProps = {
  dark?: boolean;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

/** Zero-border card. White surface with a subtle shadow, or near-black inset. */
export function Card({
  dark = false,
  className = '',
  children,
  ...rest
}: CardProps): ReactElement {
  return (
    <div
      className={[
        'rounded-2xl',
        dark
          ? 'bg-ink text-bg'
          : 'bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.08)]',
        className,
      ].join(' ')}
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
