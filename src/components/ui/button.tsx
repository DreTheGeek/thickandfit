import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactElement } from 'react';
import Link from 'next/link';

type Variant = 'primary' | 'light' | 'ghost' | 'outline';
type Size = 'md' | 'sm' | 'xs' | 'block';

const BASE =
  'tf-press inline-flex items-center justify-center gap-2 rounded-full font-semibold uppercase leading-none cursor-pointer disabled:cursor-default disabled:opacity-50';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white',
  light: 'bg-bg text-ink', // for placement on dark cards
  ghost: 'bg-warm text-ink',
  outline: 'border border-ink text-ink bg-transparent',
};

const SIZES: Record<Size, string> = {
  md: 'text-[13px] tracking-[2px] px-7 py-3.5',
  sm: 'text-[12px] tracking-[2px] px-[18px] py-[11px]',
  xs: 'text-[11px] tracking-[2px] px-4 py-2',
  block: 'w-full text-[13px] tracking-[2px] py-[15px]',
};

export function pillClass(
  variant: Variant = 'primary',
  size: Size = 'md',
  className = '',
): string {
  return [BASE, VARIANTS[variant], SIZES[size], className].join(' ');
}

type ButtonProps = {
  variant?: Variant;
  size?: Size;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps): ReactElement {
  return <button type={type} className={pillClass(variant, size, className)} {...rest} />;
}

type ButtonLinkProps = {
  variant?: Variant;
  size?: Size;
  href: string;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className = '',
  href,
  ...rest
}: ButtonLinkProps): ReactElement {
  return <Link href={href} className={pillClass(variant, size, className)} {...rest} />;
}
