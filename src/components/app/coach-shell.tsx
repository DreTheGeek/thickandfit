import type { ReactElement, ReactNode } from 'react';
import { CoachSidebar } from '@/components/nav/coach-sidebar';

/** Desktop coach console shell: light sidebar + scrolling content area. */
export function CoachShell({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <CoachSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
