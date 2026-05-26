import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import {
  getPatients,
  getActiveMedicationsAcrossPatients,
  getAllPreAuthClaimsForPatients,
} from '@/lib/fhirServer';
import { patientsFromBundle } from '@/lib/patientUtils';
import { TaskListClient } from '@/components/medication/TaskListClient';

export const metadata = { title: 'Doctor Task List — Synapse Health' };
export const dynamic = 'force-dynamic';

export default async function TaskListPage() {
  const queryClient = new QueryClient();
  const patientsBundle = await getPatients(0);
  queryClient.setQueryData(['patients', 0], patientsBundle);

  const patientIds = patientsFromBundle(patientsBundle)
    .map((p) => p.id)
    .filter((id): id is string => !!id);

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['active-meds-across', patientIds.join(',')],
      queryFn: () => getActiveMedicationsAcrossPatients(patientIds),
    }),
    queryClient.prefetchQuery({
      queryKey: ['preauth-claims-for', patientIds.join(',')],
      queryFn: () => getAllPreAuthClaimsForPatients(patientIds),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Doctor Task List</h1>
          <p className="mt-1 text-sm text-slate-500">
            Active prescriptions across your panel that may need prior authorization.
          </p>
        </header>
        <TaskListClient />
      </div>
    </HydrationBoundary>
  );
}
