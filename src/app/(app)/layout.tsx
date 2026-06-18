import { AppNav } from '@/components/nav/app-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white text-black">
      <AppNav />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
