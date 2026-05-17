'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownUp, Plus } from 'lucide-react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { usePatients } from '@/hooks/usePatients';
import { searchPatientsByNameClient, fetchVitals } from '@/lib/fhirClient';
import { patientsFromBundle, extractFamilyName, extractGivenName, fullName } from '@/lib/patientUtils';
import { buildVitalSnapshot } from '@/lib/vitalsUtils';
import { computeSepsisScore } from '@/lib/scoring';
import { TIER_RANK } from '@/lib/riskConfig';
import { PatientCard } from './PatientCard';
import { PatientForm } from './PatientForm';
import { SearchBar } from './SearchBar';
import { Modal } from '@/components/ui/Modal';
import { SkeletonGrid } from '@/components/ui/SkeletonCard';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { EmptyState } from '@/components/ui/EmptyState';

type SortMode = 'risk' | 'alpha';

export function PatientListClient() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('risk');
  const [createOpen, setCreateOpen] = useState(false);

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

  const sorted = useMemo(() => {
    if (sortMode === 'alpha') {
      return [...filtered].sort((a, b) =>
        (extractFamilyName(a) || extractGivenName(a)).localeCompare(extractFamilyName(b) || extractGivenName(b)),
      );
    }
    return filtered;
  }, [filtered, sortMode]);

  const total = list.data?.total;
  const showingFromServerSearch = !!debouncedSearch && remoteSearch.isFetching;

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-500">
            {sorted.length} {sorted.length === 1 ? 'patient' : 'patients'}
            {total != null && !debouncedSearch ? ` · ${total} total` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortMode((m) => (m === 'risk' ? 'alpha' : 'risk'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            aria-label="Toggle sort mode"
          >
            <ArrowDownUp className="h-4 w-4" />
            Sort: {sortMode === 'risk' ? 'Risk' : 'Name'}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add patient
          </button>
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} />

      {list.isLoading && !list.data ? (
        <SkeletonGrid count={6} />
      ) : list.error ? (
        <ErrorPanel
          title="Could not load patients"
          message={list.error instanceof Error ? list.error.message : 'Unknown error'}
          onRetry={() => list.refetch()}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          title={debouncedSearch ? 'No patients found' : 'No patients yet'}
          message={debouncedSearch ? 'Try a different search term.' : 'Add your first patient to get started.'}
          action={
            !debouncedSearch ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add patient
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {showingFromServerSearch && (
            <p className="text-xs text-slate-500">Searching FHIR server…</p>
          )}
          {sortMode === 'risk' ? (
            <RiskSortedList patients={sorted} />
          ) : (
            sorted.map((p) => <PatientCard key={p.id} patient={p} />)
          )}
        </div>
      )}

      {!debouncedSearch && sorted.length > 0 && (
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New patient">
        <PatientForm
          mode="create"
          onSuccess={(id) => {
            setCreateOpen(false);
            if (id) router.push(`/patients/${id}`);
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>
    </div>
  );
}

function RiskSortedList({ patients }: { patients: fhir4.Patient[] }) {
  const vitalsResults = useQueries({
    queries: patients.map((p) => ({
      queryKey: ['vitals', p.id!],
      queryFn: () => fetchVitals(p.id!),
    })),
  });

  const enriched = patients.map((p, i) => {
    const vitals = vitalsResults[i]?.data;
    const score = vitals ? computeSepsisScore(buildVitalSnapshot(vitals)) : undefined;
    return { patient: p, score };
  });

  const sorted = [...enriched].sort((a, b) => {
    const aRank = a.score ? TIER_RANK[a.score.tier] : 0;
    const bRank = b.score ? TIER_RANK[b.score.tier] : 0;
    if (bRank !== aRank) return bRank - aRank;
    const aNews = a.score?.news2.total ?? 0;
    const bNews = b.score?.news2.total ?? 0;
    return bNews - aNews;
  });

  return (
    <>
      {sorted.map(({ patient }) => (
        <PatientCard key={patient.id} patient={patient} />
      ))}
    </>
  );
}
