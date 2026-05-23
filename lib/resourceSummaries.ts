import { formatDate } from './dateUtils';

export interface ResourceSummary {
  title: string;
  meta?: string;
  status?: string;
}

function codeableConceptText(cc: fhir4.CodeableConcept | undefined): string | undefined {
  if (!cc) return undefined;
  if (cc.text) return cc.text;
  return cc.coding?.find((c) => c.display)?.display ?? cc.coding?.[0]?.code;
}

function codingDisplay(cc: fhir4.CodeableConcept | undefined): string | undefined {
  if (!cc?.coding?.length) return undefined;
  const c = cc.coding[0];
  return c.code ? `${c.code}${c.system ? ` (${shortenSystem(c.system)})` : ''}` : undefined;
}

function shortenSystem(system: string): string {
  if (system.includes('loinc')) return 'LOINC';
  if (system.includes('icd-10') || system.includes('icd10')) return 'ICD-10';
  if (system.includes('snomed')) return 'SNOMED';
  if (system.includes('rxnorm')) return 'RxNorm';
  if (system.includes('cpt')) return 'CPT';
  return system.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function summarizeObservation(o: fhir4.Observation): ResourceSummary {
  const title = codeableConceptText(o.code) ?? 'Observation';
  let value: string | undefined;
  if (o.valueQuantity?.value != null) {
    value = `${o.valueQuantity.value}${o.valueQuantity.unit ? ` ${o.valueQuantity.unit}` : ''}`;
  } else if (o.valueString) {
    value = o.valueString;
  } else if (o.valueCodeableConcept) {
    value = codeableConceptText(o.valueCodeableConcept);
  } else if (o.component?.length) {
    value = o.component
      .map((c) => {
        const label = codeableConceptText(c.code);
        const v = c.valueQuantity?.value != null ? `${c.valueQuantity.value}${c.valueQuantity.unit ? ` ${c.valueQuantity.unit}` : ''}` : '';
        return label ? `${label}: ${v}` : v;
      })
      .filter(Boolean)
      .join(' · ');
  }
  return {
    title,
    meta: [value, formatDate(o.effectiveDateTime), codingDisplay(o.code)].filter(Boolean).join(' · '),
    status: o.status,
  };
}

export function summarizeCondition(c: fhir4.Condition): ResourceSummary {
  return {
    title: codeableConceptText(c.code) ?? 'Condition',
    meta: [codingDisplay(c.code), `onset ${formatDate(c.onsetDateTime)}`].filter(Boolean).join(' · '),
    status: c.clinicalStatus?.coding?.[0]?.code ?? c.clinicalStatus?.text,
  };
}

export function summarizeMedicationRequest(m: fhir4.MedicationRequest): ResourceSummary {
  const med = codeableConceptText(m.medicationCodeableConcept) ?? 'Medication';
  const dose = m.dosageInstruction?.[0]?.text;
  return {
    title: med,
    meta: [dose, `prescribed ${formatDate(m.authoredOn)}`, codingDisplay(m.medicationCodeableConcept)].filter(Boolean).join(' · '),
    status: m.status,
  };
}

export function summarizeAllergyIntolerance(a: fhir4.AllergyIntolerance): ResourceSummary {
  const reaction = a.reaction?.[0]?.manifestation?.[0]?.text
    ?? a.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display;
  return {
    title: codeableConceptText(a.code) ?? 'Allergy',
    meta: [a.criticality && `criticality: ${a.criticality}`, reaction && `reaction: ${reaction}`].filter(Boolean).join(' · '),
    status: a.clinicalStatus?.coding?.[0]?.code,
  };
}

export function summarizeImmunization(i: fhir4.Immunization): ResourceSummary {
  return {
    title: codeableConceptText(i.vaccineCode) ?? 'Immunization',
    meta: [`given ${formatDate(i.occurrenceDateTime)}`, codingDisplay(i.vaccineCode)].filter(Boolean).join(' · '),
    status: i.status,
  };
}

export function summarizeEncounter(e: fhir4.Encounter): ResourceSummary {
  const cls = e.class?.display ?? e.class?.code;
  const type = e.type?.[0] ? codeableConceptText(e.type[0]) : undefined;
  return {
    title: type ?? cls ?? 'Encounter',
    meta: [cls && cls !== type ? `class: ${cls}` : undefined, e.period?.start && `start ${formatDate(e.period.start)}`, e.period?.end && `end ${formatDate(e.period.end)}`].filter(Boolean).join(' · '),
    status: e.status,
  };
}

export function summarizeProcedure(p: fhir4.Procedure): ResourceSummary {
  return {
    title: codeableConceptText(p.code) ?? 'Procedure',
    meta: [
      p.performedDateTime && `performed ${formatDate(p.performedDateTime)}`,
      p.performedPeriod?.start && `performed ${formatDate(p.performedPeriod.start)}`,
      codingDisplay(p.code),
    ].filter(Boolean).join(' · '),
    status: p.status,
  };
}

export function summarizeDiagnosticReport(d: fhir4.DiagnosticReport): ResourceSummary {
  return {
    title: codeableConceptText(d.code) ?? 'Diagnostic Report',
    meta: [formatDate(d.effectiveDateTime), d.conclusion && `conclusion: ${d.conclusion}`].filter(Boolean).join(' · '),
    status: d.status,
  };
}

export function summarizeClaim(c: fhir4.Claim): ResourceSummary {
  const total = c.total?.value != null ? `${c.total.value} ${c.total.currency ?? ''}`.trim() : undefined;
  const type = codeableConceptText(c.type);
  return {
    title: `Claim${type ? ` (${type})` : ''}`,
    meta: [c.use, total && `total: ${total}`, c.billablePeriod?.start && `period ${formatDate(c.billablePeriod.start)}`].filter(Boolean).join(' · '),
    status: c.status,
  };
}

export type AnySummarizable =
  | fhir4.Observation
  | fhir4.Condition
  | fhir4.MedicationRequest
  | fhir4.AllergyIntolerance
  | fhir4.Immunization
  | fhir4.Encounter
  | fhir4.Procedure
  | fhir4.DiagnosticReport
  | fhir4.Claim;

export function summarize(resource: fhir4.Resource): ResourceSummary {
  switch (resource.resourceType) {
    case 'Observation':        return summarizeObservation(resource as fhir4.Observation);
    case 'Condition':          return summarizeCondition(resource as fhir4.Condition);
    case 'MedicationRequest':  return summarizeMedicationRequest(resource as fhir4.MedicationRequest);
    case 'AllergyIntolerance': return summarizeAllergyIntolerance(resource as fhir4.AllergyIntolerance);
    case 'Immunization':       return summarizeImmunization(resource as fhir4.Immunization);
    case 'Encounter':          return summarizeEncounter(resource as fhir4.Encounter);
    case 'Procedure':          return summarizeProcedure(resource as fhir4.Procedure);
    case 'DiagnosticReport':   return summarizeDiagnosticReport(resource as fhir4.DiagnosticReport);
    case 'Claim':              return summarizeClaim(resource as fhir4.Claim);
    default:                   return { title: resource.resourceType };
  }
}
