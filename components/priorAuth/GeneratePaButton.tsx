'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { JustificationModal } from './JustificationModal';

export function GeneratePaButton({
  patientId,
  medicationRequest,
}: {
  patientId: string;
  medicationRequest: fhir4.MedicationRequest;
}) {
  const [open, setOpen] = useState(false);

  if (medicationRequest.status !== 'active') return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        <FileText className="h-3 w-3" aria-hidden={true} />
        Generate PA
      </button>

      <JustificationModal
        open={open}
        onClose={() => setOpen(false)}
        patientId={patientId}
        medicationRequest={medicationRequest}
      />
    </>
  );
}
