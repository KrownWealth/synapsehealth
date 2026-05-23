'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { SidebarDrawer } from './Sidebar';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>
      <SidebarDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
