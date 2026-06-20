import type { ReactElement, ReactNode, SVGProps } from 'react';

/**
 * Thin line-icon set, traced from the design-handoff prototypes.
 * stroke currentColor, width 1.8, round caps/joins. No emoji anywhere in the product.
 */

const PATHS = {
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 3v3M16 3v3" />
    </>
  ),
  chat: <path d="M21 11.5a8 8 0 0 1-11.5 7.2L4 20l1.3-4.5A8 8 0 1 1 21 11.5z" />,
  dumbbell: <path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" />,
  nutrition: (
    <>
      <path d="M7 3v7M5 3v4a2 2 0 0 0 4 0V3M7 10v11" />
      <path d="M16 3c-1.2 0-2 2-2 5s.8 4 2 4m0 0v9" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  water: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  steps: <path d="M3 12h4l2 6 4-14 2.5 8H21" />,
  camera: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a1.5 1.5 0 0 1 1.5-1.5H19V19H6a2 2 0 0 0-2 2z" />
      <path d="M4 19.5A1.5 1.5 0 0 1 5.5 18H19" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.5M12 19v2.5M3 12h2.5M18.5 12H21M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2 17 7M7 17l-1.8 1.8" />
    </>
  ),
  ruler: (
    <>
      <path d="M3 16.5 16.5 3 21 7.5 7.5 21z" />
      <path d="M7.5 12l1.8 1.8M11 8.5l1.8 1.8M14.5 5l1.8 1.8" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 4.5V3.5h6v1M9 10h6M9 14h6" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.5 2.5 0 0 1 4 1.8c0 1.5-2 1.9-2 3.2" />
      <circle cx="11.5" cy="17.4" r=".6" fill="currentColor" stroke="none" />
    </>
  ),
  community: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6" />
      <path d="M16.5 13.5a5 5 0 0 1 4 5.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5 21 21" />
    </>
  ),
  paperclip: (
    <path d="M21.5 12.5 12 22a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8" />
  ),
  send: <path d="M12 19V5M5 12l7-7 7 7" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  file: (
    <>
      <path d="M14 3v5h5" />
      <path d="M7 3h8l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    </>
  ),
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M5 12.5 10 17 19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  flame: (
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
  ),
  noAlcohol: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6 18.4 18.4" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  bolt: <path d="M13 3 5 13h6l-1 8 8-11h-6z" />,
  megaphone: (
    <>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l9 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M18 8.5a4 4 0 0 1 0 7" />
    </>
  ),
  pulse: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  home: <path d="M4 11.5 12 4l8 7.5M6 10v9h12v-9" />,
  funnel: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  refresh: <path d="M20 11a8 8 0 0 0-14-4l-2 2m0-4v4h4m-6 2a8 8 0 0 0 14 4l2-2m0 4v-4h-4" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
    </>
  ),
  barcode: (
    <>
      <path d="M3 5v14M7 5v14M11 5v10M11 17v2M15 5v14M19 5v10M19 17v2" />
    </>
  ),
  heart: (
    <path d="M12 20.5 4.2 12.7a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5z" />
  ),
  play: <path d="M7 5.5v13l11-6.5z" />,
} as const;

export type IconName = keyof typeof PATHS;

type IconProps = {
  name: IconName;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, 'name'>;

export function Icon({
  name,
  size = 24,
  strokeWidth = 1.8,
  className,
  ...rest
}: IconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Solid play triangle (used on exercise demo thumbnails). */
export function PlayIcon({
  size = 12,
  className,
}: {
  size?: number | string;
  className?: string;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/** Person glyph used inside monogram avatar circles. */
export function PersonGlyph({
  className,
}: {
  className?: string;
}): ReactElement {
  return (
    <svg
      width="44%"
      height="44%"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="8.5" r="3.3" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
    </svg>
  );
}

/** Generic 24x24 line-icon wrapper for one-off custom paths. */
export function LineIcon({
  size = 24,
  strokeWidth = 1.8,
  className,
  children,
}: {
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}
