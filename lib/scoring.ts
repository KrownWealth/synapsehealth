export type RiskTier = 'critical' | 'high' | 'medium' | 'low';

export interface VitalSnapshot {
  heartRate?: number;
  respiratoryRate?: number;
  systolicBP?: number;
  temperature?: number;
  spo2?: number;
  consciousness?: 'alert' | 'altered';
  onSupplementalO2?: boolean;
}

export interface ScoreCriterion {
  label: string;
  value: string;
  threshold: string;
  met: boolean;
}

export interface QsofaResult  { score: number; criteria: ScoreCriterion[]; }
export interface SirsResult   { score: number; criteria: ScoreCriterion[]; }
export interface News2ParameterScore { parameter: string; value: string; points: number; }
export interface News2Result  { total: number; breakdown: News2ParameterScore[]; hasSingleParamAt3: boolean; }
export interface SepsisScore  { qsofa: QsofaResult; sirs: SirsResult; news2: News2Result; tier: RiskTier; }

export function computeQsofa(v: VitalSnapshot): QsofaResult {
  const criteria: ScoreCriterion[] = [
    { label: 'Resp. rate ≥ 22 br/min', value: v.respiratoryRate != null ? `${v.respiratoryRate}` : 'N/A', threshold: '≥ 22',    met: (v.respiratoryRate ?? 0) >= 22 },
    { label: 'Altered mentation',       value: v.consciousness ?? 'unknown',                               threshold: 'altered', met: v.consciousness === 'altered' },
    { label: 'Systolic BP ≤ 100 mmHg', value: v.systolicBP != null ? `${v.systolicBP}` : 'N/A',          threshold: '≤ 100',   met: (v.systolicBP ?? 999) <= 100 },
  ];
  return { score: criteria.filter((c) => c.met).length, criteria };
}

export function computeSirs(v: VitalSnapshot): SirsResult {
  const criteria: ScoreCriterion[] = [
    { label: 'Temp > 38°C or < 36°C', value: v.temperature != null ? `${v.temperature.toFixed(1)}°C` : 'N/A', threshold: '> 38 or < 36', met: v.temperature != null && (v.temperature > 38 || v.temperature < 36) },
    { label: 'Heart rate > 90 bpm',    value: v.heartRate != null ? `${v.heartRate}` : 'N/A',                  threshold: '> 90',          met: (v.heartRate ?? 0) > 90 },
    { label: 'Resp. rate > 20 br/min', value: v.respiratoryRate != null ? `${v.respiratoryRate}` : 'N/A',      threshold: '> 20',          met: (v.respiratoryRate ?? 0) > 20 },
  ];
  return { score: criteria.filter((c) => c.met).length, criteria };
}

export function computeNews2(v: VitalSnapshot): News2Result {
  const breakdown: News2ParameterScore[] = [];
  const s = (parameter: string, value: number | undefined, points: number) =>
    breakdown.push({ parameter, value: value != null ? String(value) : 'N/A', points });

  const rr = v.respiratoryRate;
  s('Respiratory rate', rr,  rr == null ? 0 : rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3);

  const spo2 = v.spo2;
  s('SpO₂', spo2, spo2 == null ? 0 : spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0);

  s('Supplemental O₂', undefined, v.onSupplementalO2 ? 2 : 0);

  const sbp = v.systolicBP;
  s('Systolic BP', sbp, sbp == null ? 0 : sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3);

  const hr = v.heartRate;
  s('Heart rate', hr, hr == null ? 0 : hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3);

  s('Consciousness', undefined, v.consciousness === 'altered' ? 3 : 0);

  const temp = v.temperature;
  s('Temperature', temp, temp == null ? 0 : temp <= 35.0 ? 3 : temp <= 36.0 ? 1 : temp <= 38.0 ? 0 : temp <= 39.0 ? 1 : 2);

  const total = breakdown.reduce((sum, b) => sum + b.points, 0);
  const hasSingleParamAt3 = breakdown.some((b) => b.points >= 3);
  return { total, breakdown, hasSingleParamAt3 };
}

export function computeRiskTier(q: QsofaResult, s: SirsResult, n: News2Result): RiskTier {
  if (q.score >= 2 && n.total >= 7) return 'critical';
  if (q.score >= 2 || n.total >= 7) return 'high';
  if (s.score >= 2 || n.total >= 5 || n.hasSingleParamAt3) return 'medium';
  return 'low';
}

export function computeSepsisScore(v: VitalSnapshot): SepsisScore {
  const qsofa = computeQsofa(v);
  const sirs  = computeSirs(v);
  const news2 = computeNews2(v);
  return { qsofa, sirs, news2, tier: computeRiskTier(qsofa, sirs, news2) };
}
