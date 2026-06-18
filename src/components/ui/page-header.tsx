// Shared interior page header: olive keyline + condensed display title (matches the auth pages).
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-8">
      <div className="mb-3 h-1 w-12 bg-olive" />
      <h1 className="font-display text-5xl uppercase leading-none text-ink sm:text-6xl">{title}</h1>
      {subtitle ? <p className="mt-3 max-w-prose text-sm text-neutral-500">{subtitle}</p> : null}
    </header>
  );
}
