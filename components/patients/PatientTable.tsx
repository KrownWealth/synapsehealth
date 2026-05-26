'use client';

import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { calculateAge, formatDate } from '@/lib/dateUtils';
import { fullName, initials } from '@/lib/patientUtils';

function mrnOf(p: fhir4.Patient): string | undefined {
  if (!p.identifier?.length) return undefined;
  const mr = p.identifier.find(
    (i) => i.type?.coding?.some((c) => c.code === 'MR') || /mrn|mr/i.test(i.type?.text ?? ''),
  );
  return (mr ?? p.identifier[0])?.value;
}

export function PatientTable({
  patients,
  onEdit,
}: {
  patients: fhir4.Patient[];
  onEdit: (patient: fhir4.Patient) => void;
}) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <Th>Name</Th>
              <Th>Sex</Th>
              <Th>Date of birth</Th>
              <Th>Age</Th>
              <Th>MRN</Th>
              <Th className="text-right pr-5">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => {
              const age = calculateAge(p.birthDate);
              const sex = p.gender
                ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1)
                : '—';
              const mrn = mrnOf(p);

              return (
                <tr
                  key={p.id}
                  onClick={() => p.id && router.push(`/patients/${p.id}`)}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                        {initials(p)}
                      </div>
                      <span className="font-medium text-slate-900">{fullName(p)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{sex}</td>
                  <td className="px-5 py-3 text-slate-700">{formatDate(p.birthDate)}</td>
                  <td className="px-5 py-3 text-slate-700">{age != null ? `${age} yrs` : '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{mrn ?? '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(p);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      <Pencil className="h-3 w-3" aria-hidden={true} />
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-5 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}
