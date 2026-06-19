import type { ReactElement } from 'react';

/** Stephanie's real script wordmark. Black on light, white on dark. */
export function Wordmark({
  tone = 'black',
  height = 22,
  className = '',
}: {
  tone?: 'black' | 'white';
  height?: number;
  className?: string;
}): ReactElement {
  const src = tone === 'white' ? '/brand/logo-white.svg' : '/brand/logo-black.svg';
  return (
    // eslint-disable-next-line @next/next/no-img-element -- vector wordmark, intrinsic size irrelevant
    <img src={src} alt="Thick & Fit" style={{ height }} className={className} />
  );
}
