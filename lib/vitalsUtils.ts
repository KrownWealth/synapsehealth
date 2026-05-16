import type { VitalSnapshot } from './scoring';

export const LOINC = {
  HEART_RATE:       '8867-4',
  RESPIRATORY_RATE: '9279-1',
  SYSTOLIC_BP:      '8480-6',
  DIASTOLIC_BP:     '8462-4',
  BLOOD_PRESSURE:   '55284-4',
  TEMPERATURE:      '8310-5',
  SPO2:             '59408-5',
  WEIGHT:           '29463-7',
  HEIGHT:           '8302-2',
  BMI:              '39156-5',
} as const;

export function getLatestObservation(bundle: fhir4.Bundle, loincCode: string) {
  return (bundle.entry ?? [])
    .map((e) => e.resource as fhir4.Observation)
    .filter((obs) => obs?.code?.coding?.some((c) => c.code === loincCode))
    .sort((a, b) =>
      new Date(b.effectiveDateTime ?? 0).getTime() -
      new Date(a.effectiveDateTime ?? 0).getTime()
    )[0];
}

export function getObservationValue(obs: fhir4.Observation | undefined): number | undefined {
  if (!obs) return undefined;
  if (obs.valueQuantity?.value != null) return obs.valueQuantity.value;
  return obs.component
    ?.find((c) => c.code?.coding?.some((coding) => coding.code === LOINC.SYSTOLIC_BP))
    ?.valueQuantity?.value;
}

export function getDiastolicValue(obs: fhir4.Observation | undefined): number | undefined {
  if (!obs) return undefined;
  return obs.component
    ?.find((c) => c.code?.coding?.some((coding) => coding.code === LOINC.DIASTOLIC_BP))
    ?.valueQuantity?.value;
}

export function normalizeTemperature(obs: fhir4.Observation | undefined): number | undefined {
  const value = getObservationValue(obs);
  if (value == null) return undefined;
  const unit = obs?.valueQuantity?.unit ?? obs?.valueQuantity?.code ?? '';
  if (['[degF]', 'degF', '°F', 'F'].includes(unit)) return (value - 32) * (5 / 9);
  return value;
}

export function buildVitalSnapshot(bundle: fhir4.Bundle): VitalSnapshot {
  return {
    heartRate:       getObservationValue(getLatestObservation(bundle, LOINC.HEART_RATE)),
    respiratoryRate: getObservationValue(getLatestObservation(bundle, LOINC.RESPIRATORY_RATE)),
    systolicBP:      getObservationValue(getLatestObservation(bundle, LOINC.SYSTOLIC_BP))
                     ?? getObservationValue(getLatestObservation(bundle, LOINC.BLOOD_PRESSURE)),
    temperature:     normalizeTemperature(getLatestObservation(bundle, LOINC.TEMPERATURE)),
    spo2:            getObservationValue(getLatestObservation(bundle, LOINC.SPO2)),
    consciousness:   'alert',
    onSupplementalO2: false,
  };
}

export interface VitalRange { low: number; high: number; unit: string; }

export const VITAL_RANGES: Record<string, VitalRange> = {
  heartRate:       { low: 40,   high: 130,  unit: 'bpm' },
  respiratoryRate: { low: 8,    high: 25,   unit: 'br/min' },
  systolicBP:      { low: 90,   high: 180,  unit: 'mmHg' },
  diastolicBP:     { low: 50,   high: 110,  unit: 'mmHg' },
  temperature:     { low: 35.0, high: 39.1, unit: '°C' },
  spo2:            { low: 92,   high: 100,  unit: '%' },
  bmi:             { low: 16,   high: 35,   unit: 'kg/m²' },
};

export function isOutOfRange(vital: string, value: number): boolean {
  const range = VITAL_RANGES[vital];
  if (!range) return false;
  return value < range.low || value > range.high;
}

export interface TrendPoint {
  timestamp: string;
  heartRate?: number;
  respiratoryRate?: number;
  systolicBP?: number;
}

export function buildVitalsTrend(bundle: fhir4.Bundle): TrendPoint[] {
  const buckets = new Map<string, TrendPoint>();
  for (const entry of bundle.entry ?? []) {
    const obs = entry.resource as fhir4.Observation;
    const time = obs?.effectiveDateTime;
    if (!time) continue;
    const bucket = buckets.get(time) ?? { timestamp: time };
    const code = obs.code?.coding?.[0]?.code;
    if (code === LOINC.HEART_RATE) bucket.heartRate = obs.valueQuantity?.value;
    else if (code === LOINC.RESPIRATORY_RATE) bucket.respiratoryRate = obs.valueQuantity?.value;
    else if (code === LOINC.SYSTOLIC_BP) bucket.systolicBP = obs.valueQuantity?.value;
    else if (code === LOINC.BLOOD_PRESSURE) {
      const sys = obs.component?.find((c) => c.code?.coding?.some((cd) => cd.code === LOINC.SYSTOLIC_BP))?.valueQuantity?.value;
      if (sys != null) bucket.systolicBP = sys;
    }
    buckets.set(time, bucket);
  }
  return Array.from(buckets.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
