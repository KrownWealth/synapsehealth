'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { summarize } from '@/lib/resourceSummaries';

const STATUS_CLASS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-slate-100 text-slate-700',
  stopped: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-slate-100 text-slate-500',
  inactive: 'bg-slate-100 text-slate-500',
  resolved: 'bg-slate-100 text-slate-500',
  final: 'bg-slate-100 text-slate-700',
  preliminary: 'bg-amber-100 text-amber-800',
  draft: 'bg-amber-100 text-amber-800',
  entered: 'bg-amber-100 text-amber-800',
  'in-progress': 'bg-blue-100 text-blue-800',
};

export function ResourceEntry({
  resource,
  action,
}: {
  resource: fhir4.Resource;
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const summary = summarize(resource);
  const statusKey = (summary.status ?? '').toLowerCase();
  const statusClass = STATUS_CLASS[statusKey] ?? 'bg-slate-100 text-slate-600';

  const toggle = () => setOpen((v) => !v);

  return (
    <li className="border-b border-slate-100 last:border-0">
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
      >
        <ChevronRight
          className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="truncate text-sm font-medium text-slate-900">{summary.title}</p>
            {summary.status && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusClass}`}>
                {summary.status}
              </span>
            )}
          </div>
          {summary.meta && (
            <p className="mt-0.5 truncate text-xs text-slate-500">{summary.meta}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
        {/* <code className="flex-shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
          {resource.resourceType}/{resource.id ?? '—'}
        </code> */}
      </div>
      {/* {open && (
        <pre className="overflow-x-auto bg-slate-900 px-4 py-3 text-[11px] leading-relaxed text-slate-100">
          {JSON.stringify(resource, null, 2)}
        </pre>
      )} */}
    </li>
  );
}
