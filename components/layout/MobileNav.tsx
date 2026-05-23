'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, Menu } from 'lucide-react';
import { SidebarDrawer } from './Sidebar';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-slate-900">SepSofa</p>
            <p className="truncate text-[10px] leading-tight text-slate-500">PA Accelerator</p>
          </div>
        </Link>

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
