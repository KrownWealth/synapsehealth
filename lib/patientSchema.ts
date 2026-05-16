import { z } from 'zod';

export const patientFormSchema = z.object({
  givenName: z
    .string()
    .min(1, 'Given name is required')
    .regex(/^[a-zA-Z\s\-']+$/, 'Letters, spaces, hyphens, and apostrophes only'),
  familyName: z
    .string()
    .min(1, 'Family name is required')
    .regex(/^[a-zA-Z\s\-']+$/, 'Letters, spaces, hyphens, and apostrophes only'),
  gender: z.enum(['male', 'female', 'other', 'unknown'], {
    required_error: 'Please select a gender',
  }),
  birthDate: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((d) => new Date(d) < new Date(), 'Date of birth cannot be in the future')
    .refine((d) => {
      const min = new Date();
      min.setFullYear(min.getFullYear() - 130);
      return new Date(d) > min;
    }, 'Cannot be more than 130 years ago'),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;

export function toFhirPatient(values: PatientFormValues, existingId?: string): fhir4.Patient {
  return {
    resourceType: 'Patient',
    ...(existingId && { id: existingId }),
    name: [{ use: 'official', family: values.familyName, given: [values.givenName] }],
    gender: values.gender,
    birthDate: values.birthDate,
  };
}
