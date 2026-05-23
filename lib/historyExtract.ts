import { formatDate } from './dateUtils';

export type Tone = 'red' | 'amber' | 'emerald' | 'slate' | 'blue' | 'indigo';

export interface RowChip {
  label: string;
  tone?: Tone;
}

export interface RowData {
  /** Headline of the row, e.g. medication or condition name. */
  title: string;
  /** Code chip in monospace (e.g. "LOINC 4548-4"). */
  codeChip?: string;
  /** The clinically interesting value, e.g. "5.99 % · Ref: 4.0–5.6". */
  valueLine?: string;
  /** Status pill on the right, color-coded. */
  statusPill?: RowChip;
  /** Optional second pill (e.g. "above range" interpretation). */
  secondaryPill?: RowChip;
  /** Bottom line such as "Drawn 09 Oct 2024 · Dr Howe". */
  dateLine?: string;
  /** Sort key (ISO datetime). Most-recent first when present. */
  sortDate?: string;
}

function codeText(cc: fhir4.CodeableConcept | undefined): string | undefined {
  if (!cc) return undefined;
  if (cc.text) return cc.text;
  const display = cc.coding?.find((c) => c.display)?.display;
  return display ?? cc.coding?.[0]?.code;
}

function shortSystem(system: string): string {
  if (system.includes('loinc')) return 'LOINC';
  if (system.includes('icd-10') || system.includes('icd10')) return 'ICD-10';
  if (system.includes('snomed')) return 'SNOMED';
  if (system.includes('rxnorm')) return 'RxNorm';
  if (system.includes('cpt')) return 'CPT';
  return system.replace(/^https?:\/\//, '').split('/').pop() ?? system;
}

function codeChip(cc: fhir4.CodeableConcept | undefined): string | undefined {
  const c = cc?.coding?.[0];
  if (!c?.code) return undefined;
  return c.system ? `${shortSystem(c.system)} ${c.code}` : c.code;
}

const ACTIVE_TONE: Tone = 'emerald';
const NEUTRAL_TONE: Tone = 'slate';
const WARN_TONE: Tone = 'amber';
const BAD_TONE: Tone = 'red';
const INFO_TONE: Tone = 'blue';

const STATUS_TONE: Record<string, Tone> = {
  active: ACTIVE_TONE,
  completed: NEUTRAL_TONE,
  stopped: NEUTRAL_TONE,
  cancelled: NEUTRAL_TONE,
  inactive: NEUTRAL_TONE,
  resolved: NEUTRAL_TONE,
  final: NEUTRAL_TONE,
  preliminary: WARN_TONE,
  draft: WARN_TONE,
  entered: WARN_TONE,
  'entered-in-error': BAD_TONE,
  'in-progress': INFO_TONE,
  unknown: NEUTRAL_TONE,
};

function statusPill(status: string | undefined): RowChip | undefined {
  if (!status) return undefined;
  return { label: status, tone: STATUS_TONE[status.toLowerCase()] ?? NEUTRAL_TONE };
}

// ────────────────────────────────────────────────────────────────────────────

function condition(c: fhir4.Condition): RowData {
  const clinical = c.clinicalStatus?.coding?.[0]?.code ?? c.clinicalStatus?.text;
  return {
    title: codeText(c.code) ?? 'Condition',
    codeChip: codeChip(c.code),
    statusPill: statusPill(clinical),
    dateLine: c.onsetDateTime ? `Onset ${formatDate(c.onsetDateTime)}` : undefined,
    sortDate: c.onsetDateTime,
  };
}

function medication(m: fhir4.MedicationRequest): RowData {
  return {
    title: codeText(m.medicationCodeableConcept) ?? 'Medication',
    codeChip: codeChip(m.medicationCodeableConcept),
    valueLine: m.dosageInstruction?.[0]?.text,
    statusPill: statusPill(m.status),
    dateLine: m.authoredOn ? `Prescribed ${formatDate(m.authoredOn)}` : undefined,
    sortDate: m.authoredOn,
  };
}

function interpretationPill(o: fhir4.Observation): RowChip | undefined {
  const interp = o.interpretation?.[0]?.coding?.[0]?.code?.toUpperCase();
  if (!interp) return undefined;
  if (interp === 'H' || interp === 'HH') return { label: 'Above range', tone: BAD_TONE };
  if (interp === 'L' || interp === 'LL') return { label: 'Below range', tone: BAD_TONE };
  if (interp === 'A' || interp === 'AA') return { label: 'Abnormal', tone: WARN_TONE };
  if (interp === 'N') return { label: 'Normal', tone: ACTIVE_TONE };
  return { label: o.interpretation?.[0]?.coding?.[0]?.display ?? interp, tone: NEUTRAL_TONE };
}

function observation(o: fhir4.Observation): RowData {
  const value = (() => {
    if (o.valueQuantity?.value != null) {
      return `${o.valueQuantity.value}${o.valueQuantity.unit ? ' ' + o.valueQuantity.unit : ''}`;
    }
    if (o.valueString) return o.valueString;
    if (o.valueCodeableConcept) return codeText(o.valueCodeableConcept);
    return undefined;
  })();
  const range = o.referenceRange?.[0];
  const rangeText = (() => {
    if (range?.text) return range.text;
    if (range?.low?.value != null && range?.high?.value != null) {
      const unit = range.high.unit ?? range.low.unit ?? '';
      return `${range.low.value}–${range.high.value}${unit ? ' ' + unit : ''}`;
    }
    if (range?.high?.value != null) return `≤ ${range.high.value}${range.high.unit ? ' ' + range.high.unit : ''}`;
    if (range?.low?.value != null) return `≥ ${range.low.value}${range.low.unit ? ' ' + range.low.unit : ''}`;
    return undefined;
  })();

  const parts: string[] = [];
  if (value) parts.push(value);
  if (rangeText) parts.push(`Ref ${rangeText}`);

  return {
    title: codeText(o.code) ?? 'Observation',
    codeChip: codeChip(o.code),
    valueLine: parts.length ? parts.join(' · ') : undefined,
    statusPill: statusPill(o.status),
    secondaryPill: interpretationPill(o),
    dateLine: o.effectiveDateTime ? `Drawn ${formatDate(o.effectiveDateTime)}` : undefined,
    sortDate: o.effectiveDateTime,
  };
}

function allergy(a: fhir4.AllergyIntolerance): RowData {
  const reaction =
    a.reaction?.[0]?.manifestation?.[0]?.text ??
    a.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display;
  const criticality = a.criticality;
  const critTone: Tone =
    criticality === 'high' ? BAD_TONE : criticality === 'low' ? WARN_TONE : NEUTRAL_TONE;
  return {
    title: codeText(a.code) ?? 'Allergy',
    codeChip: codeChip(a.code),
    valueLine: reaction ? `Reaction: ${reaction}` : undefined,
    statusPill: statusPill(a.clinicalStatus?.coding?.[0]?.code),
    secondaryPill: criticality ? { label: `criticality: ${criticality}`, tone: critTone } : undefined,
    dateLine: a.recordedDate ? `Recorded ${formatDate(a.recordedDate)}` : undefined,
    sortDate: a.recordedDate,
  };
}

function immunization(i: fhir4.Immunization): RowData {
  return {
    title: codeText(i.vaccineCode) ?? 'Immunization',
    codeChip: codeChip(i.vaccineCode),
    statusPill: statusPill(i.status),
    dateLine: i.occurrenceDateTime ? `Given ${formatDate(i.occurrenceDateTime)}` : undefined,
    sortDate: i.occurrenceDateTime,
  };
}

function encounter(e: fhir4.Encounter): RowData {
  const cls = e.class?.display ?? e.class?.code;
  const type = e.type?.[0] ? codeText(e.type[0]) : undefined;
  const start = e.period?.start;
  const end = e.period?.end;
  const dateLine = start
    ? end && end !== start
      ? `${formatDate(start)} → ${formatDate(end)}`
      : formatDate(start)
    : undefined;
  return {
    title: type ?? cls ?? 'Encounter',
    valueLine: cls && cls !== type ? `Class: ${cls}` : undefined,
    statusPill: statusPill(e.status),
    dateLine,
    sortDate: start,
  };
}

function procedure(p: fhir4.Procedure): RowData {
  const performed = p.performedDateTime ?? p.performedPeriod?.start;
  return {
    title: codeText(p.code) ?? 'Procedure',
    codeChip: codeChip(p.code),
    statusPill: statusPill(p.status),
    dateLine: performed ? `Performed ${formatDate(performed)}` : undefined,
    sortDate: performed,
  };
}

function diagnosticReport(d: fhir4.DiagnosticReport): RowData {
  return {
    title: codeText(d.code) ?? 'Diagnostic Report',
    codeChip: codeChip(d.code),
    valueLine: d.conclusion,
    statusPill: statusPill(d.status),
    dateLine: d.effectiveDateTime ? formatDate(d.effectiveDateTime) : undefined,
    sortDate: d.effectiveDateTime,
  };
}

function claim(c: fhir4.Claim): RowData {
  const total = c.total?.value != null ? `${c.total.value} ${c.total.currency ?? ''}`.trim() : undefined;
  const type = codeText(c.type);
  const parts: string[] = [];
  if (c.use) parts.push(`use: ${c.use}`);
  if (total) parts.push(`total: ${total}`);
  return {
    title: `Claim${type ? ` · ${type}` : ''}`,
    valueLine: parts.length ? parts.join(' · ') : undefined,
    statusPill: statusPill(c.status),
    dateLine: c.created
      ? `Created ${formatDate(c.created)}`
      : c.billablePeriod?.start
        ? `Period from ${formatDate(c.billablePeriod.start)}`
        : undefined,
    sortDate: c.created ?? c.billablePeriod?.start,
  };
}

export function extractRow(resource: fhir4.Resource): RowData {
  switch (resource.resourceType) {
    case 'Condition':
      return condition(resource as fhir4.Condition);
    case 'MedicationRequest':
      return medication(resource as fhir4.MedicationRequest);
    case 'Observation':
      return observation(resource as fhir4.Observation);
    case 'AllergyIntolerance':
      return allergy(resource as fhir4.AllergyIntolerance);
    case 'Immunization':
      return immunization(resource as fhir4.Immunization);
    case 'Encounter':
      return encounter(resource as fhir4.Encounter);
    case 'Procedure':
      return procedure(resource as fhir4.Procedure);
    case 'DiagnosticReport':
      return diagnosticReport(resource as fhir4.DiagnosticReport);
    case 'Claim':
      return claim(resource as fhir4.Claim);
    default:
      return { title: resource.resourceType };
  }
}
