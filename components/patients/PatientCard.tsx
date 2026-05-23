import Link from 'next/link';
import { calculateAge, formatDate } from '@/lib/dateUtils';
import { fullName, initials } from '@/lib/patientUtils';

export function PatientCard({ patient }: { patient: fhir4.Patient }) {
  const age = calculateAge(patient.birthDate);
  const gender = patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : 'Unknown';

  return (
    <Link
      href={`/patients/${patient.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
          {initials(patient)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{fullName(patient)}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {gender} · {age != null ? `${age} yrs` : 'Age unknown'} · DOB {formatDate(patient.birthDate)}
          </p>
        </div>
        <code className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">
          Patient/{patient.id}
        </code>
      </div>
    </Link>
  );
}
