import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import {
  getPatient,
  getObservations,
  getConditions,
  getMedications,
  getAllergies,
  getImmunizations,
  getEncounters,
  getProcedures,
  getDiagnosticReports,
  getClaims,
} from '@/lib/fhirServer';
import { PatientDetailClient } from '@/components/patients/PatientDetailClient';

export const metadata = { title: 'Patient — SepSofa' };
export const dynamic = 'force-dynamic';

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  const queryClient = new QueryClient();
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: ['patient',            params.id], queryFn: () => getPatient(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['observations',       params.id], queryFn: () => getObservations(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['conditions',         params.id], queryFn: () => getConditions(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['medications',        params.id], queryFn: () => getMedications(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['allergies',          params.id], queryFn: () => getAllergies(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['immunizations',      params.id], queryFn: () => getImmunizations(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['encounters',         params.id], queryFn: () => getEncounters(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['procedures',         params.id], queryFn: () => getProcedures(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['diagnostic-reports', params.id], queryFn: () => getDiagnosticReports(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['claims',             params.id], queryFn: () => getClaims(params.id) }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PatientDetailClient patientId={params.id} />
    </HydrationBoundary>
  );
}
