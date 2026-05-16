const INFECTION_KEYWORDS = [
  'pneumonia',
  'uti',
  'urinary tract',
  'cellulitis',
  'bacteremia',
  'bacteraemia',
  'sepsis',
  'septic',
  'abscess',
  'wound infection',
  'infection',
  'infectious',
  'meningitis',
  'endocarditis',
  'cholangitis',
  'pyelonephritis',
  'osteomyelitis',
];

const ANTIBIOTIC_KEYWORDS = [
  'amoxicillin',
  'ampicillin',
  'penicillin',
  'azithromycin',
  'ceftriaxone',
  'cefazolin',
  'cefepime',
  'cephalexin',
  'ciprofloxacin',
  'clindamycin',
  'doxycycline',
  'erythromycin',
  'gentamicin',
  'levofloxacin',
  'linezolid',
  'meropenem',
  'metronidazole',
  'piperacillin',
  'tazobactam',
  'tobramycin',
  'trimethoprim',
  'sulfamethoxazole',
  'vancomycin',
  'aztreonam',
  'imipenem',
  'nitrofurantoin',
  'rifampin',
  'tetracycline',
  'cefoxitin',
  'moxifloxacin',
];

function conditionText(condition: fhir4.Condition): string {
  const codeText = condition.code?.text ?? '';
  const displays = condition.code?.coding?.map((c) => c.display ?? '').join(' ') ?? '';
  return `${codeText} ${displays}`.toLowerCase();
}

export function isInfectionCondition(condition: fhir4.Condition): boolean {
  const text = conditionText(condition);
  return INFECTION_KEYWORDS.some((kw) => text.includes(kw));
}

export function hasInfectionSource(conditions: fhir4.Condition[]): boolean {
  return conditions.some(isInfectionCondition);
}

function medicationText(med: fhir4.MedicationRequest): string {
  const codeText = med.medicationCodeableConcept?.text ?? '';
  const displays = med.medicationCodeableConcept?.coding?.map((c) => c.display ?? '').join(' ') ?? '';
  return `${codeText} ${displays}`.toLowerCase();
}

export function isAntibiotic(med: fhir4.MedicationRequest): boolean {
  const text = medicationText(med);
  return ANTIBIOTIC_KEYWORDS.some((kw) => text.includes(kw));
}

export function hasActiveAntibiotic(medications: fhir4.MedicationRequest[]): boolean {
  return medications.some(isAntibiotic);
}
