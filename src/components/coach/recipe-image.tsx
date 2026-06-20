'use client';

import { useState, type ReactElement } from 'react';
import Image from 'next/image';
import { Icon, type IconName } from '@/components/ui/icons';

// next/image with a graceful fallback. Lenus image URLs are signed + expire, so on any load
// error (or null src) we swap to the icon placeholder instead of a broken-image box.
export function RecipeImage({
  src,
  alt,
  icon = 'nutrition',
  sizes,
  imgClassName = 'object-cover',
}: {
  src: string | null;
  alt: string;
  icon?: IconName;
  sizes?: string;
  imgClassName?: string;
}): ReactElement {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-faint">
        <Icon name={icon} size={36} />
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} className={imgClassName} unoptimized onError={() => setFailed(true)} />;
}
