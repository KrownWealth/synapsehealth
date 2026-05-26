'use client';

import type { ReactNode } from 'react';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { EmptyState } from '@/components/ui/EmptyState';

export function IpsSectionCard({
  title,
  loinc,
  count,
  isLoading,
  error,
  children,
  emptyTitle,
}: {
  title: string;
  loinc?: string;
  count: number;
  isLoading?: boolean;
  error?: unknown;
  children: ReactNode;
  emptyTitle?: string;
}) {
  const showData = !isLoading && !error && count > 0;

  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">{title}</h2>
          {loinc && (
            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{loinc}</p>
          )}
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
          {isLoading ? '…' : count === 1 ? '1 entry' : `${count} entries`}
        </span>
      </div>

      {showData ? (
        // Scrollable data region — both axes scroll independently inside the card so a long
        // section doesn't push the page and a wide table doesn't break the layout.
        <div className="max-h-[480px] overflow-auto border-t border-slate-200">
          {children}
        </div>
      ) : (
        <div className="border-t border-slate-200 px-5 py-4">
          {isLoading ? (
            <SkeletonCard />
          ) : error ? (
            <ErrorPanel
              title={`Could not load ${title.toLowerCase()}`}
              message={error instanceof Error ? error.message : 'Unknown error'}
            />
          ) : (
            <EmptyState title={emptyTitle ?? `No ${title.toLowerCase()} on record`} />
          )}
        </div>
      )}
    </section>
  );
}
