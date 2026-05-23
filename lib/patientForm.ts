export type Gender = 'male' | 'female' | 'other' | 'unknown';

export type MaritalCode = 'S' | 'M' | 'D' | 'W' | 'UNK' | '';

export interface PatientFormValues {
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  maritalStatus: MaritalCode;
  active: boolean;
}

export const EMPTY_FORM: PatientFormValues = {
  firstName: '',
  lastName: '',
  gender: 'unknown',
  birthDate: '',
  phone: '',
  email: '',
  street: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  maritalStatus: '',
  active: true,
};

export type FieldErrors = Partial<Record<keyof PatientFormValues, string>>;

const NAME_MAX = 80;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EARLIEST_DOB = '1900-01-01';

/** Today's date in `YYYY-MM-DD` form (local time). Used as the DOB max. */
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Validate a patient form. Returns a map of field -> human-readable error message.
 * An empty object means the form is valid.
 */
export function validateForm(form: PatientFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const validGenders: Gender[] = ['male', 'female', 'other', 'unknown'];

  if (!form.firstName.trim()) errors.firstName = 'First name is required.';
  else if (form.firstName.trim().length > NAME_MAX)
    errors.firstName = `First name must be ${NAME_MAX} characters or fewer.`;

  if (!form.lastName.trim()) errors.lastName = 'Last name is required.';
  else if (form.lastName.trim().length > NAME_MAX)
    errors.lastName = `Last name must be ${NAME_MAX} characters or fewer.`;

  if (!validGenders.includes(form.gender)) errors.gender = 'Select a valid gender.';

  if (!form.birthDate) {
    errors.birthDate = 'Date of birth is required.';
  } else {
    const dob = new Date(form.birthDate);
    if (Number.isNaN(dob.getTime())) {
      errors.birthDate = 'Date of birth must be a valid date.';
    } else if (form.birthDate > todayIso()) {
      errors.birthDate = 'Date of birth cannot be in the future.';
    } else if (form.birthDate < EARLIEST_DOB) {
      errors.birthDate = `Date of birth cannot be before ${EARLIEST_DOB}.`;
    }
  }

  if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim()))
    errors.email = 'Enter a valid email address.';

  return errors;
}

const MARITAL_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus';
const MARITAL_DISPLAY: Record<Exclude<MaritalCode, ''>, string> = {
  S: 'Never Married',
  M: 'Married',
  D: 'Divorced',
  W: 'Widowed',
  UNK: 'Unknown',
};

export const MARITAL_OPTIONS: Array<{ value: MaritalCode; label: string }> = [
  { value: '', label: '— Not recorded —' },
  { value: 'S', label: 'Never Married' },
  { value: 'M', label: 'Married' },
  { value: 'D', label: 'Divorced' },
  { value: 'W', label: 'Widowed' },
  { value: 'UNK', label: 'Unknown' },
];

export const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
];

function buildTelecom(form: PatientFormValues): fhir4.ContactPoint[] | undefined {
  const out: fhir4.ContactPoint[] = [];
  if (form.phone.trim()) out.push({ system: 'phone', value: form.phone.trim() });
  if (form.email.trim()) out.push({ system: 'email', value: form.email.trim() });
  return out.length ? out : undefined;
}

function buildAddress(form: PatientFormValues): fhir4.Address[] | undefined {
  const hasAny =
    form.street.trim() ||
    form.city.trim() ||
    form.state.trim() ||
    form.postalCode.trim() ||
    form.country.trim();
  if (!hasAny) return undefined;
  const addr: fhir4.Address = {};
  if (form.street.trim()) addr.line = [form.street.trim()];
  if (form.city.trim()) addr.city = form.city.trim();
  if (form.state.trim()) addr.state = form.state.trim();
  if (form.postalCode.trim()) addr.postalCode = form.postalCode.trim();
  if (form.country.trim()) addr.country = form.country.trim();
  return [addr];
}

function buildMaritalStatus(form: PatientFormValues): fhir4.CodeableConcept | undefined {
  if (!form.maritalStatus) return undefined;
  return {
    coding: [
      {
        system: MARITAL_SYSTEM,
        code: form.maritalStatus,
        display: MARITAL_DISPLAY[form.maritalStatus],
      },
    ],
    text: MARITAL_DISPLAY[form.maritalStatus],
  };
}

/**
 * Build a fresh Patient resource for POST. No `id` is set — the server assigns one.
 */
export function patientFromForm(form: PatientFormValues): fhir4.Patient {
  return {
    resourceType: 'Patient',
    active: form.active,
    name: [
      {
        family: form.lastName.trim(),
        given: [form.firstName.trim()],
      },
    ],
    gender: form.gender,
    birthDate: form.birthDate || undefined,
    telecom: buildTelecom(form),
    address: buildAddress(form),
    maritalStatus: buildMaritalStatus(form),
  };
}

/**
 * Merge form fields into an existing Patient, preserving anything the form doesn't touch
 * (identifiers, communication languages, photo, etc.).
 */
export function applyFormToPatient(
  existing: fhir4.Patient,
  form: PatientFormValues,
): fhir4.Patient {
  const draft = patientFromForm(form);
  return {
    ...existing,
    active: draft.active,
    name: draft.name,
    gender: draft.gender,
    birthDate: draft.birthDate,
    telecom: draft.telecom,
    address: draft.address,
    maritalStatus: draft.maritalStatus,
  };
}

/**
 * Pre-fill the form from an existing Patient. Inverse of patientFromForm for the
 * subset of fields this form exposes.
 */
export function formFromPatient(p: fhir4.Patient | undefined): PatientFormValues {
  if (!p) return { ...EMPTY_FORM };
  const name = p.name?.[0];
  const addr = p.address?.[0];
  const phone = p.telecom?.find((t) => t.system === 'phone')?.value ?? '';
  const email = p.telecom?.find((t) => t.system === 'email')?.value ?? '';
  const maritalCode = (p.maritalStatus?.coding?.find((c) => c.system === MARITAL_SYSTEM)?.code
    ?? p.maritalStatus?.coding?.[0]?.code
    ?? '') as MaritalCode;
  return {
    firstName: name?.given?.[0] ?? '',
    lastName: name?.family ?? '',
    gender: (p.gender as Gender) ?? 'unknown',
    birthDate: p.birthDate ?? '',
    phone,
    email,
    street: addr?.line?.[0] ?? '',
    city: addr?.city ?? '',
    state: addr?.state ?? '',
    postalCode: addr?.postalCode ?? '',
    country: addr?.country ?? '',
    maritalStatus: ['S', 'M', 'D', 'W', 'UNK'].includes(maritalCode) ? maritalCode : '',
    active: p.active !== false,
  };
}
