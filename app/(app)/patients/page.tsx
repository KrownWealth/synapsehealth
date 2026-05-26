import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getPatients } from '@/lib/fhirServer';
import { PatientListClient } from '@/components/patients/PatientListClient';
import { AddPatientButton } from '@/components/patients/AddPatientButton';

export const metadata = { title: 'Patient List — Synapse Health' };
export const dynamic = 'force-dynamic';

export default async function PatientsPage() {
  const queryClient = new QueryClient();
  const patientsBundle = await getPatients(0);
  queryClient.setQueryData(['patients', 0], patientsBundle);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Patient List</h1>
            <p className="mt-1 text-sm text-slate-500">
              Search, browse, and open patient charts.
            </p>
          </div>
          <AddPatientButton />
        </header>
        <PatientListClient />
      </div>
    </HydrationBoundary>
  );
}
