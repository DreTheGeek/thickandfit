import type { ReactElement, ReactNode } from 'react';
import { Wordmark } from '@/components/ui/wordmark';
import { AuthLanguageSwitch } from '@/components/auth/auth-language-switch';

/** Centered, light auth card (design-handoff aesthetic). */
export function AuthShell({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-12">
      <div className="tf-fade-up w-full max-w-sm rounded-2xl bg-surface p-8 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <Wordmark height={30} className="mb-7" />
        {title != null && <h1 className="tf-display mb-6 text-[34px]">{title}</h1>}
        {children}
      </div>
      {/* OUTSIDE the card, under it. Every auth screen shares this shell, so one mount covers
          sign-in, sign-up, forgot and reset. It is the only way to change language while signed
          out, and this is the screen where being unable to is a locked door rather than an
          annoyance. */}
      <AuthLanguageSwitch />
    </div>
  );
}
