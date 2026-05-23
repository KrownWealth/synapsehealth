import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-20 hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile hamburger + drawer */}
      <MobileNav />

      <main className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
