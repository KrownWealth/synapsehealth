import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getPatients } from '@/lib/fhirServer';
import { PatientListClient } from '@/components/patients/PatientListClient';

export const metadata = { title: 'Patients — SepSofa' };
export const dynamic = 'force-dynamic';

export default async function PatientListPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['patients', 0],
    queryFn: () => getPatients(0),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PatientListClient />
    </HydrationBoundary>
  );
}
