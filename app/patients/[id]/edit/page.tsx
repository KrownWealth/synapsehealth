import { PatientForm } from '@/components/patients/PatientForm';

export const metadata = { title: 'Edit Patient — SepSofa' };

export default function EditPatientPage({ params }: { params: { id: string } }) {
  return <PatientForm mode="edit" patientId={params.id} />;
}
