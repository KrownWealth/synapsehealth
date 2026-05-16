import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getPatient, getVitals, getConditions, getMedications } from '@/lib/fhirServer';
import { PatientDetailClient } from '@/components/patients/PatientDetailClient';

export const metadata = { title: 'Patient — SepSofa' };
export const dynamic = 'force-dynamic';

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  const queryClient = new QueryClient();
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: ['patient',     params.id], queryFn: () => getPatient(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['vitals',      params.id], queryFn: () => getVitals(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['conditions',  params.id], queryFn: () => getConditions(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['medications', params.id], queryFn: () => getMedications(params.id) }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PatientDetailClient patientId={params.id} />
    </HydrationBoundary>
  );
}
