'use client';

import { useState, useEffect } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { PatientForm } from './PatientForm';
import {
  EMPTY_FORM,
  patientFromForm,
  validateForm,
  type FieldErrors,
  type PatientFormValues,
} from '@/lib/patientForm';
import { useCreatePatient } from '@/hooks/usePatientMutations';

export function CreatePatientModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [values, setValues] = useState<PatientFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showErrors, setShowErrors] = useState(false);
  const create = useCreatePatient();
  const { mutate, reset, isPending, isError, error } = create;

  useEffect(() => {
    if (!open) {
      setValues(EMPTY_FORM);
      setErrors({});
      setShowErrors(false);
      reset();
    }
  }, [open, reset]);

  // Re-validate as the user types, but only surface messages once they've tried to submit.
  useEffect(() => {
    if (showErrors) setErrors(validateForm(values));
  }, [values, showErrors]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateForm(values);
    setErrors(v);
    setShowErrors(true);
    if (Object.keys(v).length > 0) return;
    mutate(patientFromForm(values), {
      onSuccess: () => onClose(),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Add new patient" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <PatientForm values={values} onChange={setValues} errors={errors} />

        {isError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" aria-hidden={true} />
            <div>
              <p className="font-medium">Could not create patient.</p>
              <p className="mt-0.5 text-xs text-red-800">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isPending ? 'Creating…' : 'Create patient'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
