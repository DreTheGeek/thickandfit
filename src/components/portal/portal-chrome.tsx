// Shared 8.0 chrome (.planning/design_handoff/8.0/client-portal.html).
//
// Six of the eight remaining screens open with the same header and tab row, and need the same media
// row, stat triad and meter. They are built once here so a screen is composition rather than a
// fresh set of one-off divs, and so the gutter, the type ramp and the tab behaviour cannot drift
// screen by screen the way they did before.
//
// NO 'use client', deliberately, exactly like today-cards.tsx. These are presentational: every value
// arrives as a prop and nothing reads the database or holds state. That matters because the screens
// are split between the two kinds of component. today-screen.tsx and diary-screen.tsx are client;
// you-screen.tsx is an async server component. A primitive that reached for useState would block the
// second kind, and a primitive that is merely *rendered* by a client parent needs no directive of
// its own.
//
// The interactive ones (PortalTabs, PortalButton with onClick) take their handler as a prop, so they
// are usable from a client screen and will correctly refuse to accept a function from a server one.
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/icons';

/* ------------------------------------------------------------------------------------------------
 * Ground
 * ---------------------------------------------------------------------------------------------- */

/**
 * A card that sits RAISED above the page, in either palette.
 *
 * This exists because `<Card dark>` encoded an inversion instead of a role: `bg-ink text-bg`. In the
 * light theme ink is #0f0f0f and bg is #e7e5df, so it rendered a dark card on warm paper, which was
 * the intent. Inside `.tf-portal` ink is #ffffff and bg is #000000, so the same class pair rendered a
 * WHITE BLOCK on a black screen. It shipped that way on /community, /you and /account.
 *
 * `bg-warm` is the raised surface in both palettes, #dddbd3 on paper and #19191c on black, so the
 * card keeps its separation from the page without the tokens flipping underneath it.
 *
 * The rule worth carrying: `.tf-portal` re-themes anything written in ROLES for free and silently
 * inverts anything written in the two LITERAL ends of a palette. Name the role, never the end.
 */
export function RaisedCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return <div className={`rounded-2xl bg-warm text-ink ${className}`}>{children}</div>;
}

/**
 * The screen gutter, decided once.
 *
 * The re-skinned screens used `px-[22px] pb-7 pt-3` and the unrestyled ones each invented their own
 * (`max-w-[760px] px-4 py-6` on the diary, `max-w-2xl px-4 py-6` on community, `px-[22px] py-4` on
 * the inbox), so moving between tabs shifted the left edge of the content. The handoff is a 390px
 * phone with a 16-18px gutter; 22px is what Today and Train already ship and what the rest align to.
 *
 * `max-w` is deliberately absent: the shell above already centres and constrains, and a second
 * constraint here was how two of those screens ended up narrower than their neighbours.
 */
export function PortalScreen({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return <div className={`px-[22px] pb-7 pt-3 ${className}`}>{children}</div>;
}

/* ------------------------------------------------------------------------------------------------
 * Header
 * ---------------------------------------------------------------------------------------------- */

/** The handoff's 36px `.icon-btn`: a circle on the raised surface, used for the header affordance. */
export function PortalIconButton({
  icon,
  href,
  onClick,
  label,
}: {
  icon: IconName;
  href?: string;
  onClick?: () => void;
  label: string;
}): ReactElement {
  const cls = 'tf-press grid h-9 w-9 place-items-center rounded-full bg-warm text-ink';
  if (href) {
    return (
      <Link href={href} aria-label={label} className={cls}>
        <Icon name={icon} size={16} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>
      <Icon name={icon} size={16} />
    </button>
  );
}

/**
 * The handoff's `.mobile-header`: a 25px black title, an optional line under it, an optional control.
 *
 * Replaces PageHeader inside the portal. PageHeader is a 44-56px title with an ink keyline, which is
 * marketing scale: on a 390px phone it spends a fifth of the viewport before any content. It stays
 * where it belongs, on the public site and the coach console.
 */
export function PortalHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string | null;
  right?: ReactNode;
}): ReactElement {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="tf-display text-[25px] font-black leading-none tracking-[-1px]">{title}</h1>
        {sub ? <small className="mt-0.5 block text-muted">{sub}</small> : null}
      </div>
      {right ? <div className="flex flex-none items-center gap-1.5">{right}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Tabs
 * ---------------------------------------------------------------------------------------------- */

/**
 * The handoff's tab rows: `.train-tabs` (underline) and `.fuel-tabs` (a filled grid).
 *
 * SCROLLS RATHER THAN SQUEEZES, and that is the whole design decision in this component. A flex row
 * shrinks each item until the label wraps, which reads as broken rather than as full; UnderlineTabs
 * already reached this conclusion and documented it. It matters most on Progress, which the handoff
 * gives five tabs: in Spanish those are Resumen / Cuerpo / Fuerza / Fotos / Constancia, and five of
 * those at 12px do not fit 390px minus the gutter. The row scrolls, the scrollbar is hidden, and
 * `snap` keeps a partially-scrolled tab from sitting half off the edge.
 *
 * `grid` is the exception: it is for a small fixed set (three on Fuel) where the handoff wants equal
 * thirds, so it must not scroll.
 */
export function PortalTabs<T extends string>({
  value,
  onChange,
  options,
  variant = 'underline',
  className = '',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  variant?: 'underline' | 'grid';
  className?: string;
}): ReactElement {
  if (variant === 'grid') {
    return (
      <div
        role="tablist"
        className={`mb-3 grid gap-1.5 rounded-full bg-warm p-1 ${className}`}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(o.value)}
              className={[
                'tf-press truncate rounded-full py-2 text-center text-[11px] font-semibold',
                active ? 'bg-ink text-bg' : 'text-muted',
              ].join(' ')}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={`tf-scroll mb-3 flex snap-x gap-[18px] overflow-x-auto ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={[
              'tf-press flex-none snap-start whitespace-nowrap pb-2 text-[12px]',
              active ? 'border-b-2 border-ink text-ink' : 'text-faint',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Buttons
 * ---------------------------------------------------------------------------------------------- */

/**
 * The handoff's three buttons: `.btn-white`, `.btn-outline`, `.btn-action`.
 *
 * `action` is the first consumer of `--c-action` (#edff00), which globals.css has defined since the
 * 8.0 token block landed and which nothing referenced. It is a THIRD role, not a second accent: green
 * stays functional-only (a hit target, an AMRAP marker) and yellow carries a primary call to action,
 * so neither has to mean two things. The handoff spends it on exactly one control per screen.
 */
export function PortalButton({
  children,
  href,
  onClick,
  variant = 'white',
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'white' | 'outline' | 'action';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}): ReactElement {
  const base =
    'tf-press block w-full rounded-full py-3.5 text-center text-[13px] font-black uppercase tracking-[0.5px]';
  const tone = {
    white: 'bg-ink text-bg',
    outline: 'border border-line text-ink',
    action: 'bg-action text-action-ink',
  }[variant];
  const cls = `${base} ${tone} ${disabled ? 'opacity-40' : ''} ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Rows and figures
 * ---------------------------------------------------------------------------------------------- */

/**
 * One row of thumbnail + title + sub, with an optional trailing slot.
 *
 * The handoff draws this five times under different class names, `.meal` on Fuel, `.next-exercise`
 * in the player, `.ingredient` on the scan result, `.post-user` on Community and `.context-main` in
 * the coach thread. They differ only in what fills the thumb and what sits on the right.
 *
 * `thumb` is a slot rather than an image URL because two of those five are not images: the scan
 * result uses a round colour tile and the coach thread uses an avatar.
 */
export function PortalMediaRow({
  thumb,
  title,
  sub,
  trailing,
  href,
  onClick,
}: {
  thumb?: ReactNode;
  title: string;
  sub?: string | null;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
}): ReactElement {
  const inner = (
    <>
      {thumb ? <div className="flex-none">{thumb}</div> : null}
      <div className="min-w-0 flex-1 text-left">
        <strong className="block truncate text-[12px]">{title}</strong>
        {sub ? <small className="block truncate text-faint">{sub}</small> : null}
      </div>
      {trailing ? <div className="flex-none">{trailing}</div> : null}
    </>
  );
  const cls = 'flex w-full items-center gap-2.5';

  if (href) {
    return (
      <Link href={href} className={`tf-press ${cls}`}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`tf-press ${cls}`}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/**
 * An n-up row of figure-over-label.
 *
 * The handoff draws this as `.weight-grid`, `.macro-row`, `.result-macros`, `.main-stats` and
 * `.profile-stats`, which is five names for one component. TransformCard's start/current/goal triad
 * is the first caller.
 *
 * NOT yet used by StatCell (activities-screen.tsx) or Stat (you-screen.tsx), which look like
 * duplicates of each other and of this, and are not: StatCell is py-3.5 / 22px / a 10px uppercase
 * tracked label, Stat is py-4 / 24px / an 11px plain one, and both draw a `border-r` divider this
 * has no notion of. Folding them in now would mean either changing two shipped screens during a
 * refactor whose whole pass condition is that nothing moves, or giving this primitive three
 * near-identical size variants so it can preserve two legacy treatments forever. They convert when
 * their screens take the 8.0 treatment and adopt `.profile-stats` for real.
 *
 * `align` exists because the handoff's weight triad is left / centre / right across three cells,
 * where every other use is uniformly centred or left.
 */
export function PortalStatRow({
  stats,
  size = 'sm',
  align = 'left',
  className = '',
}: {
  stats: { key: string; value: ReactNode; label: string; tone?: 'default' | 'hit' }[];
  size?: 'sm' | 'lg';
  align?: 'left' | 'center' | 'spread';
  className?: string;
}): ReactElement {
  // No font-weight on `sm`: the element is a <strong>, so the browser default already applies, and
  // naming a weight here would have quietly lightened the three figures inside TransformCard from
  // bold to semibold while this was being called a pure refactor.
  const valueCls = size === 'lg' ? 'tf-display text-[30px] leading-none' : 'text-[13px]';
  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0,1fr))` }}
    >
      {stats.map((s, i) => {
        // "spread" pushes the first cell left and the last right, which is the handoff's weight grid.
        const cellAlign =
          align === 'spread'
            ? i === 0
              ? 'text-left'
              : i === stats.length - 1
                ? 'text-right'
                : 'text-center'
            : align === 'center'
              ? 'text-center'
              : 'text-left';
        return (
          <div key={s.key} className={cellAlign}>
            <strong className={`block tabular-nums ${valueCls} ${s.tone === 'hit' ? 'text-accent' : ''}`}>
              {s.value}
            </strong>
            <span className="block text-[8px] uppercase tracking-[0.6px] text-faint">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The handoff's `.progress-line` and `.set-line`: a 5px rail with an ink fill.
 *
 * Clamps rather than trusting its input. Every caller computes a percentage from data that can be
 * missing or ahead of target (a member past her goal weight, a set count beyond the prescription),
 * and an unclamped width renders a bar out of its own track.
 */
export function PortalMeter({
  pct,
  height = 5,
  tone = 'ink',
  className = '',
}: {
  pct: number;
  height?: number;
  tone?: 'ink' | 'accent' | 'action';
  className?: string;
}): ReactElement {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const fill = { ink: 'bg-ink', accent: 'bg-accent', action: 'bg-action' }[tone];
  return (
    <div
      className={`overflow-hidden rounded-full bg-warm ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i className={`block h-full rounded-full ${fill}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** The handoff's `.summary-row`: a label on the left, a figure on the right. */
export function PortalDataRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'hit';
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 truncate text-[13px] text-muted">{label}</span>
      <strong className={`flex-none text-[13px] tabular-nums ${tone === 'hit' ? 'text-accent' : ''}`}>
        {value}
      </strong>
    </div>
  );
}
