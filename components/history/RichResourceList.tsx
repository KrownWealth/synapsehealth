'use client';

import type { ReactNode } from 'react';
import { extractRow } from '@/lib/historyExtract';
import { entriesFromBundle } from '@/lib/patientUtils';
import { RichRow } from './RichRow';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { EmptyState } from '@/components/ui/EmptyState';

export function RichResourceList({
  title,
  resourceType,
  bundle,
  isLoading,
  error,
  renderAction,
}: {
  title: string;
  resourceType: string;
  bundle: fhir4.Bundle | undefined;
  isLoading?: boolean;
  error?: unknown;
  renderAction?: (resource: fhir4.Resource) => ReactNode;
}) {
  if (isLoading) return <SkeletonCard />;
  if (error)
    return (
      <ErrorPanel
        title={`Could not load ${title}`}
        message={error instanceof Error ? error.message : 'Unknown error'}
      />
    );

  const entries = entriesFromBundle(bundle).filter((r) => r.resourceType === resourceType);
  if (entries.length === 0) {
    return <EmptyState title={`No ${title.toLowerCase()} on record`} />;
  }

  // Sort by sortDate desc when available (most recent first).
  const sorted = [...entries].sort((a, b) => {
    const ra = extractRow(a).sortDate ?? '';
    const rb = extractRow(b).sortDate ?? '';
    return rb.localeCompare(ra);
  });

  return (
    <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {sorted.map((r) => (
        <RichRow
          key={`${r.resourceType}/${r.id ?? Math.random()}`}
          row={extractRow(r)}
          action={renderAction?.(r)}
        />
      ))}
    </ul>
  );
}
