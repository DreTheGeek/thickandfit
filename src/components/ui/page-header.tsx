// Shared interior page header: ink keyline + condensed display title.
import type { ReactElement } from 'react';

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}): ReactElement {
  return (
    <header className="mb-8">
      <div className="mb-3 h-1 w-12 bg-ink" />
      <h1 className="tf-display text-[44px] sm:text-[56px]">{title}</h1>
      {subtitle ? <p className="mt-3 max-w-prose text-sm text-muted">{subtitle}</p> : null}
    </header>
  );
}
