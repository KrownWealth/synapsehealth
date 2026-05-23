'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CreatePatientModal } from './CreatePatientModal';

export function AddPatientButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        <Plus className="h-4 w-4" aria-hidden={true} />
        Add patient
      </button>
      <CreatePatientModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
