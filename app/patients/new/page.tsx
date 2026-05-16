import { PatientForm } from '@/components/patients/PatientForm';

export const metadata = { title: 'New Patient — SepSofa' };

export default function NewPatientPage() {
  return <PatientForm mode="create" />;
}
