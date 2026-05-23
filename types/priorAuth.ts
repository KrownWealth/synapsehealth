export interface MedicationEvidence {
  id: string;
  display: string;
  rxnormCode?: string;
  dose?: string;
  authoredOn?: string;
  status: string;
}

export interface ConditionEvidence {
  id: string;
  display: string;
  icd10Code?: string;
  snomedCode?: string;
  onsetDate?: string;
  clinicalStatus?: string;
}

export interface LabEvidence {
  id: string;
  display: string;
  loincCode?: string;
  value?: string;
  unit?: string;
  effectiveDateTime?: string;
  interpretation?: string;
}

export interface PriorMedicationEvidence {
  id: string;
  display: string;
  status: string;
  authoredOn?: string;
  statusReason?: string;
}

export interface NoteEvidence {
  id: string;
  display: string;
  type?: string;
  date?: string;
}

export interface CoverageEvidence {
  id: string;
  payerName?: string;
  status?: string;
}

export interface EvidenceBundle {
  patientId: string;
  patientName?: string;
  medicationRequestId: string;
  medication: MedicationEvidence;
  activeConditions: ConditionEvidence[];
  recentLabs: LabEvidence[];
  priorMedications: PriorMedicationEvidence[];
  recentNotes: NoteEvidence[];
  coverage: CoverageEvidence | null;
  gaps: string[];
  fetchedAt: string;
  /** Per-source fetch timings — used to verify the parallel batch behavior. */
  timings: {
    startedAt: number;
    durations: Record<string, number>;
    totalMs: number;
  };
}

export interface Citation {
  resourceType: string;
  resourceId: string;
  detail: string;
}

export interface Justification {
  diagnosisRationale: string;
  supportingEvidence: string;
  priorTherapyRationale: string;
  narrative: string;
  citations: Citation[];
  missingEvidence: string[];
}
