'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePatients } from '@/hooks/usePatients';
import { searchPatientsByNameClient } from '@/lib/fhirClient';
import { patientsFromBundle, fullName } from '@/lib/patientUtils';
import { PatientCard } from './PatientCard';
import { SearchBar } from './SearchBar';
import { SkeletonGrid } from '@/components/ui/SkeletonCard';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { EmptyState } from '@/components/ui/EmptyState';

export function PatientListClient() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = usePatients(page);
  const remoteSearch = useQuery({
    queryKey: ['patients-search', debouncedSearch],
    queryFn: () => searchPatientsByNameClient(debouncedSearch),
    enabled: debouncedSearch.length > 0,
  });

  const localPatients = useMemo(() => patientsFromBundle(list.data), [list.data]);
  const remotePatients = useMemo(
    () => (debouncedSearch ? patientsFromBundle(remoteSearch.data) : []),
    [remoteSearch.data, debouncedSearch],
  );

  const merged = useMemo(() => {
    if (!debouncedSearch) return localPatients;
    const seen = new Set<string>();
    const result: fhir4.Patient[] = [];
    for (const p of [...localPatients, ...remotePatients]) {
      if (!p.id || seen.has(p.id)) continue;
      seen.add(p.id);
      result.push(p);
    }
    return result;
  }, [localPatients, remotePatients, debouncedSearch]);

  const filtered = useMemo(() => {
    if (!search.trim()) return merged;
    const needle = search.trim().toLowerCase();
    return merged.filter((p) => fullName(p).toLowerCase().includes(needle));
  }, [merged, search]);

  const total = list.data?.total;
  const showingFromServerSearch = !!debouncedSearch && remoteSearch.isFetching;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        {filtered.length} {filtered.length === 1 ? 'patient' : 'patients'}
        {total != null && !debouncedSearch ? ` · ${total} total` : ''}
      </p>

      <SearchBar value={search} onChange={setSearch} />

      {list.isLoading && !list.data ? (
        <SkeletonGrid count={6} />
      ) : list.error ? (
        <ErrorPanel
          title="Could not load patients"
          message={list.error instanceof Error ? list.error.message : 'Unknown error'}
          onRetry={() => list.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={debouncedSearch ? 'No patients found' : 'No patients on this server'}
          message={debouncedSearch ? 'Try a different search term.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {showingFromServerSearch && (
            <p className="text-xs text-slate-500">Searching FHIR server…</p>
          )}
          {filtered.map((p) => (
            <PatientCard key={p.id} patient={p} />
          ))}
        </div>
      )}

      {!debouncedSearch && filtered.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">Page {page + 1}</span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={localPatients.length < 20}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
