'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { patientFormSchema, toFhirPatient, type PatientFormValues } from '@/lib/patientSchema';
import { fetchPatient, postPatient, putPatient } from '@/lib/fhirClient';
import { extractGivenName, extractFamilyName } from '@/lib/patientUtils';
import { ErrorPanel } from '@/components/ui/ErrorPanel';

type FormMode = 'create' | 'edit';

interface PatientFormProps {
  mode: FormMode;
  patientId?: string;
  onSuccess: (id: string | undefined) => void;
  onCancel: () => void;
}

export function PatientForm({ mode, patientId, onSuccess, onCancel }: PatientFormProps) {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | undefined>();

  const existing = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => fetchPatient(patientId!),
    enabled: mode === 'edit' && !!patientId,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      givenName: '',
      familyName: '',
      gender: undefined,
      birthDate: '',
    },
  });

  useEffect(() => {
    if (mode === 'edit' && existing.data) {
      reset({
        givenName: extractGivenName(existing.data),
        familyName: extractFamilyName(existing.data),
        gender: (existing.data.gender as PatientFormValues['gender']) ?? 'unknown',
        birthDate: existing.data.birthDate ?? '',
      });
    }
  }, [existing.data, mode, reset]);

  const create = useMutation({
    mutationFn: (values: PatientFormValues) => postPatient(toFhirPatient(values)),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      onSuccess(patient.id);
    },
    onError: (err) => setSubmitError(err instanceof Error ? err.message : 'Failed to create patient'),
  });

  const update = useMutation({
    mutationFn: (values: PatientFormValues) =>
      putPatient(patientId!, toFhirPatient(values, patientId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      onSuccess(patientId);
    },
    onError: (err) => setSubmitError(err instanceof Error ? err.message : 'Failed to update patient'),
  });

  const onSubmit = (values: PatientFormValues) => {
    setSubmitError(undefined);
    if (mode === 'create') create.mutate(values);
    else update.mutate(values);
  };

  const busy = isSubmitting || create.isPending || update.isPending;

  if (mode === 'edit' && existing.isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {submitError && <ErrorPanel title="Submission failed" message={submitError} />}

      <Field label="Given name" error={errors.givenName?.message} htmlFor="givenName">
        <input
          id="givenName"
          type="text"
          autoComplete="given-name"
          aria-invalid={!!errors.givenName}
          {...register('givenName')}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
      </Field>

      <Field label="Family name" error={errors.familyName?.message} htmlFor="familyName">
        <input
          id="familyName"
          type="text"
          autoComplete="family-name"
          aria-invalid={!!errors.familyName}
          {...register('familyName')}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
      </Field>

      <Field label="Gender" error={errors.gender?.message} htmlFor="gender">
        <select
          id="gender"
          aria-invalid={!!errors.gender}
          {...register('gender')}
          defaultValue=""
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        >
          <option value="" disabled>
            Select gender…
          </option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          <option value="unknown">Unknown</option>
        </select>
      </Field>

      <Field label="Date of birth" error={errors.birthDate?.message} htmlFor="birthDate">
        <input
          id="birthDate"
          type="date"
          aria-invalid={!!errors.birthDate}
          {...register('birthDate')}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {busy ? 'Saving…' : mode === 'create' ? 'Create patient' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
