'use client';

import type { FieldErrors, PatientFormValues } from '@/lib/patientForm';
import { GENDER_OPTIONS, MARITAL_OPTIONS, todayIso } from '@/lib/patientForm';

const baseInputClass =
  'mt-1 w-full rounded-md border px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1';
const okBorder = 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500';
const errBorder = 'border-red-400 focus:border-red-500 focus:ring-red-500';
const labelClass = 'block text-[11px] font-medium uppercase tracking-wide text-slate-500';

function fieldClass(hasError: boolean | undefined): string {
  return `${baseInputClass} ${hasError ? errBorder : okBorder}`;
}

function ErrorText({ msg }: { msg: string | undefined }) {
  if (!msg) return null;
  return <p className="mt-1 text-[11px] text-red-600">{msg}</p>;
}

export function PatientForm({
  values,
  onChange,
  errors = {},
  showActiveToggle = false,
}: {
  values: PatientFormValues;
  onChange: (next: PatientFormValues) => void;
  errors?: FieldErrors;
  showActiveToggle?: boolean;
}) {
  const set = <K extends keyof PatientFormValues>(key: K, val: PatientFormValues[K]) =>
    onChange({ ...values, [key]: val });

  return (
    <div className="space-y-4">
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className={labelClass}>
            First name <span className="text-red-600">*</span>
          </label>
          <input
            id="firstName"
            type="text"
            required
            maxLength={80}
            value={values.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            className={fieldClass(!!errors.firstName)}
            autoComplete="given-name"
            aria-invalid={!!errors.firstName}
          />
          <ErrorText msg={errors.firstName} />
        </div>
        <div>
          <label htmlFor="lastName" className={labelClass}>
            Last name <span className="text-red-600">*</span>
          </label>
          <input
            id="lastName"
            type="text"
            required
            maxLength={80}
            value={values.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            className={fieldClass(!!errors.lastName)}
            autoComplete="family-name"
            aria-invalid={!!errors.lastName}
          />
          <ErrorText msg={errors.lastName} />
        </div>
        <div>
          <label htmlFor="gender" className={labelClass}>
            Gender <span className="text-red-600">*</span>
          </label>
          <select
            id="gender"
            value={values.gender}
            onChange={(e) => set('gender', e.target.value as PatientFormValues['gender'])}
            className={fieldClass(!!errors.gender)}
            aria-invalid={!!errors.gender}
          >
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ErrorText msg={errors.gender} />
        </div>
        <div>
          <label htmlFor="birthDate" className={labelClass}>
            Date of birth <span className="text-red-600">*</span>
          </label>
          <input
            id="birthDate"
            type="date"
            required
            min="1900-01-01"
            max={todayIso()}
            value={values.birthDate}
            onChange={(e) => set('birthDate', e.target.value)}
            className={fieldClass(!!errors.birthDate)}
            aria-invalid={!!errors.birthDate}
          />
          <ErrorText msg={errors.birthDate} />
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={fieldClass(!!errors.phone)}
            autoComplete="tel"
            placeholder="+1 555 555 0123"
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            className={fieldClass(!!errors.email)}
            autoComplete="email"
            aria-invalid={!!errors.email}
          />
          <ErrorText msg={errors.email} />
        </div>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Address</legend>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <input
              type="text"
              value={values.street}
              onChange={(e) => set('street', e.target.value)}
              className={`${baseInputClass} ${okBorder}`.replace('mt-1 ', '')}
              placeholder="Street"
              autoComplete="address-line1"
            />
          </div>
          <div className="sm:col-span-3">
            <input
              type="text"
              value={values.city}
              onChange={(e) => set('city', e.target.value)}
              className={`${baseInputClass} ${okBorder}`.replace('mt-1 ', '')}
              placeholder="City"
              autoComplete="address-level2"
            />
          </div>
          <div className="sm:col-span-1">
            <input
              type="text"
              value={values.state}
              onChange={(e) => set('state', e.target.value)}
              className={`${baseInputClass} ${okBorder}`.replace('mt-1 ', '')}
              placeholder="State"
              autoComplete="address-level1"
            />
          </div>
          <div className="sm:col-span-2">
            <input
              type="text"
              value={values.postalCode}
              onChange={(e) => set('postalCode', e.target.value)}
              className={`${baseInputClass} ${okBorder}`.replace('mt-1 ', '')}
              placeholder="Postal code"
              autoComplete="postal-code"
            />
          </div>
          <div className="sm:col-span-6">
            <input
              type="text"
              value={values.country}
              onChange={(e) => set('country', e.target.value)}
              className={`${baseInputClass} ${okBorder}`.replace('mt-1 ', '')}
              placeholder="Country"
              autoComplete="country-name"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="maritalStatus" className={labelClass}>
            Marital status
          </label>
          <select
            id="maritalStatus"
            value={values.maritalStatus}
            onChange={(e) => set('maritalStatus', e.target.value as PatientFormValues['maritalStatus'])}
            className={fieldClass(false)}
          >
            {MARITAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {showActiveToggle && (
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={values.active}
                onChange={(e) => set('active', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Active patient record
            </label>
          </div>
        )}
      </fieldset>
    </div>
  );
}
