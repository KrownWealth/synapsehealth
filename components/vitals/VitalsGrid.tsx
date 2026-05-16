import { VitalCard } from './VitalCard';
import {
  LOINC,
  getLatestObservation,
  getObservationValue,
  getDiastolicValue,
  normalizeTemperature,
} from '@/lib/vitalsUtils';

export function VitalsGrid({ vitals }: { vitals: fhir4.Bundle | undefined }) {
  if (!vitals) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  const hr = getLatestObservation(vitals, LOINC.HEART_RATE);
  const rr = getLatestObservation(vitals, LOINC.RESPIRATORY_RATE);
  const bp =
    getLatestObservation(vitals, LOINC.BLOOD_PRESSURE) ??
    getLatestObservation(vitals, LOINC.SYSTOLIC_BP);
  const temp = getLatestObservation(vitals, LOINC.TEMPERATURE);
  const spo2 = getLatestObservation(vitals, LOINC.SPO2);
  const weight = getLatestObservation(vitals, LOINC.WEIGHT);
  const height = getLatestObservation(vitals, LOINC.HEIGHT);
  const bmi = getLatestObservation(vitals, LOINC.BMI);

  const systolic = bp ? getObservationValue(bp) : undefined;
  const diastolic = bp ? getDiastolicValue(bp) : undefined;
  const tempValue = normalizeTemperature(temp);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <VitalCard
        label="Heart rate"
        value={getObservationValue(hr)}
        unit="bpm"
        vitalKey="heartRate"
        recordedAt={hr?.effectiveDateTime}
      />
      <VitalCard
        label="Resp. rate"
        value={getObservationValue(rr)}
        unit="br/min"
        vitalKey="respiratoryRate"
        recordedAt={rr?.effectiveDateTime}
      />
      <VitalCard
        label="Systolic BP"
        value={systolic}
        unit="mmHg"
        vitalKey="systolicBP"
        recordedAt={bp?.effectiveDateTime}
      />
      <VitalCard
        label="Diastolic BP"
        value={diastolic}
        unit="mmHg"
        vitalKey="diastolicBP"
        recordedAt={bp?.effectiveDateTime}
      />
      <VitalCard
        label="Temperature"
        value={tempValue}
        unit="°C"
        vitalKey="temperature"
        recordedAt={temp?.effectiveDateTime}
      />
      <VitalCard
        label="SpO₂"
        value={getObservationValue(spo2)}
        unit="%"
        vitalKey="spo2"
        recordedAt={spo2?.effectiveDateTime}
      />
      <VitalCard label="Weight" value={getObservationValue(weight)} unit="kg" recordedAt={weight?.effectiveDateTime} />
      <VitalCard label="Height" value={getObservationValue(height)} unit="cm" recordedAt={height?.effectiveDateTime} />
      {getObservationValue(bmi) != null && (
        <VitalCard label="BMI" value={getObservationValue(bmi)} unit="kg/m²" vitalKey="bmi" recordedAt={bmi?.effectiveDateTime} />
      )}
    </div>
  );
}
