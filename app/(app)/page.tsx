import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import {
  getPatients,
  getActiveMedicationsAcrossPatients,
  getAllPreAuthClaimsForPatients,
} from '@/lib/fhirServer';
import { patientsFromBundle } from '@/lib/patientUtils';
import { DashboardHome } from '@/components/dashboard/DashboardHome';

export const metadata = { title: 'Dashboard — Synapse Health' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const queryClient = new QueryClient();

  // Stage 1: fetch patient panel so we know which IDs to scope the worklist to.
  const patientsBundle = await getPatients(0);
  queryClient.setQueryData(['patients', 0], patientsBundle);

  const patientIds = patientsFromBundle(patientsBundle)
    .map((p) => p.id)
    .filter((id): id is string => !!id);

  // Stage 2: fetch active meds + all PA-submission Claims (Da Vinci PAS) in parallel.
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
      <DashboardHome />
    </HydrationBoundary>
  );
}
