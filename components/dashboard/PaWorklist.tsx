'use client';

import Link from 'next/link';
import { AlertTriangle, Circle } from 'lucide-react';
import type { WorklistItem } from '@/lib/dashboardUtils';
import { formatDaysAgo } from '@/lib/dashboardUtils';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { EmptyState } from '@/components/ui/EmptyState';

function UrgencyMarker({ urgency }: { urgency: WorklistItem['urgency'] }) {
  if (urgency === 'overdue') {
    return <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" aria-label="Overdue" />;
  }
  if (urgency === 'this-week') {
    return <Circle className="h-3.5 w-3.5 flex-shrink-0 fill-amber-500 text-amber-500" aria-label="This week" />;
  }
  return <Circle className="h-3 w-3 flex-shrink-0 fill-slate-400 text-slate-400" aria-label="Fresh" />;
}

function WorklistRow({ item }: { item: WorklistItem }) {
  const days = formatDaysAgo(item.daysAgo);
  return (
    <Link
      href={`/patients/${item.patientId}`}
      className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-0 hover:bg-slate-50"
    >
      <UrgencyMarker urgency={item.urgency} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate font-medium text-slate-900">{item.patientName}</span>
          <span className="text-slate-400">·</span>
          <span className="truncate text-sm text-slate-700">{item.medication}</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Prescribed {days}
          {item.daysAgo != null && item.daysAgo >= 7 ? ' — overdue' : ''}
        </p>
      </div>
    </Link>
  );
}

export function PaWorklist({
  items,
  isLoading,
  error,
  limit,
  headingLabel = 'Needs review',
  emptyTitle = 'Inbox zero',
  emptyMessage = 'No active prescriptions are awaiting prior-auth review.',
}: {
  items: WorklistItem[];
  isLoading?: boolean;
  error?: unknown;
  limit?: number;
  headingLabel?: string;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  const open = items.filter((i) => !i.submitted);
  const visible = limit ? open.slice(0, limit) : open;
  const totalLabel = isLoading ? '…' : open.length;
  // When we're showing a slice (limit set, total exceeds limit), render an explicit
  // "X of Y" subtitle so the parens count doesn't read ambiguously. Otherwise the
  // count belongs in the heading itself.
  const isPreview = limit != null && open.length > limit;

  return (
    <section aria-labelledby="worklist-heading" className="space-y-3">
      <div>
        <h2 id="worklist-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {isPreview ? headingLabel : `${headingLabel} (${totalLabel})`}
        </h2>
        {isPreview && !isLoading && (
          <p className="mt-0.5 text-xs text-slate-500">
            Showing {Math.min(limit, visible.length)} of {open.length} prescriptions needing review
          </p>
        )}
      </div>

      {isLoading ? (
        <SkeletonCard />
      ) : error ? (
        <ErrorPanel
          title="Could not load worklist"
          message={error instanceof Error ? error.message : 'Unknown error'}
        />
      ) : open.length === 0 ? (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {visible.map((it) => (
            <WorklistRow key={it.medicationRequestId} item={it} />
          ))}
        </div>
      )}
    </section>
  );
}
