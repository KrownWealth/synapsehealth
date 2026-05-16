export function extractGivenName(patient: fhir4.Patient | undefined): string {
  return patient?.name?.[0]?.given?.join(' ') ?? '';
}

export function extractFamilyName(patient: fhir4.Patient | undefined): string {
  return patient?.name?.[0]?.family ?? '';
}

export function fullName(patient: fhir4.Patient | undefined): string {
  if (!patient) return 'Unknown';
  const given = extractGivenName(patient);
  const family = extractFamilyName(patient);
  const joined = `${given} ${family}`.trim();
  return joined || 'Unnamed patient';
}

export function initials(patient: fhir4.Patient | undefined): string {
  if (!patient) return '?';
  const given = extractGivenName(patient).charAt(0);
  const family = extractFamilyName(patient).charAt(0);
  const result = `${given}${family}`.toUpperCase();
  return result || '?';
}

export function patientsFromBundle(bundle: fhir4.Bundle | undefined): fhir4.Patient[] {
  if (!bundle?.entry) return [];
  return bundle.entry
    .map((e) => e.resource)
    .filter((r): r is fhir4.Patient => r?.resourceType === 'Patient');
}

export function conditionsFromBundle(bundle: fhir4.Bundle | undefined): fhir4.Condition[] {
  if (!bundle?.entry) return [];
  return bundle.entry
    .map((e) => e.resource)
    .filter((r): r is fhir4.Condition => r?.resourceType === 'Condition');
}

export function medicationsFromBundle(bundle: fhir4.Bundle | undefined): fhir4.MedicationRequest[] {
  if (!bundle?.entry) return [];
  return bundle.entry
    .map((e) => e.resource)
    .filter((r): r is fhir4.MedicationRequest => r?.resourceType === 'MedicationRequest');
}
