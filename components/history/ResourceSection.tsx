'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { ResourceEntry } from './ResourceEntry';
import { entriesFromBundle } from '@/lib/patientUtils';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorPanel } from '@/components/ui/ErrorPanel';

export function ResourceSection({
  title,
  resourceType,
  bundle,
  isLoading,
  error,
  defaultOpen = true,
  renderAction,
}: {
  title: string;
  resourceType: string;
  bundle: fhir4.Bundle | undefined;
  isLoading?: boolean;
  error?: unknown;
  defaultOpen?: boolean;
  renderAction?: (resource: fhir4.Resource) => ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const entries = entriesFromBundle(bundle).filter((r) => r.resourceType === resourceType);
  const count = entries.length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
      >
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {isLoading ? '…' : count}
          </span>
          <code className="text-[10px] text-slate-400">{resourceType}</code>
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-slate-200">
          {isLoading ? (
            <div className="p-3"><SkeletonCard /></div>
          ) : error ? (
            <div className="p-3">
              <ErrorPanel
                title={`Could not load ${title}`}
                message={error instanceof Error ? error.message : 'Unknown error'}
              />
            </div>
          ) : count === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-500">No {title.toLowerCase()} on record.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.map((r) => (
                <ResourceEntry
                  key={`${r.resourceType}/${r.id ?? Math.random()}`}
                  resource={r}
                  action={renderAction?.(r)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
