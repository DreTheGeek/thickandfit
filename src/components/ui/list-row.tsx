import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';

/** Square icon tile (warm grey) used as the leading element of list rows. */
export function IconTile({
  size = 38,
  rounded = false,
  className = '',
  children,
}: {
  size?: number;
  rounded?: boolean;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      className={[
        'flex shrink-0 items-center justify-center bg-warm text-ink',
        rounded ? 'rounded-[10px]' : '',
        className,
      ].join(' ')}
      style={{ width: size, height: size }}
    >
      {children}
    </div>
  );
}

type ListRowProps = {
  leading?: ReactNode;
  trailing?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  href?: string;
  onClick?: () => void;
  divider?: boolean;
  className?: string;
};

/** Standard list row: leading tile, title + sub, trailing control. */
export function ListRow({
  leading,
  trailing,
  title,
  sub,
  href,
  onClick,
  divider = true,
  className = '',
}: ListRowProps): ReactElement {
  const interactive = href != null || onClick != null;
  const inner = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{title}</div>
        {sub != null && (
          <div className="truncate text-[12px] text-faint">{sub}</div>
        )}
      </div>
      {trailing}
    </>
  );
  const cls = [
    'flex items-center gap-3.5 py-3.5 text-left',
    divider ? 'border-b border-divider' : '',
    interactive ? 'tf-press cursor-pointer' : '',
    className,
  ].join(' ');

  if (href != null) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick != null) {
    return (
      <button type="button" onClick={onClick} className={cls + ' w-full'}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}
