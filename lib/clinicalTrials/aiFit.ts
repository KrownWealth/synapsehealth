import 'server-only';

import { GoogleGenAI, Type, type SchemaUnion } from '@google/genai';
import { z } from 'zod';
import type { AiFitVerdict, TrialMatch } from '@/lib/clinicalTrials';

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const TIMEOUT_MS = 25_000;

const SYSTEM_INSTRUCTION = `You are a clinical research coordinator screening trial fit.
You will receive a patient summary and a list of recruiting trials with their
eligibility criteria and recruiting sites. For each trial, return:
  - verdict: "likely_fit" / "unclear" / "likely_ineligible"
  - reason: one short sentence citing the specific factor.

Rules:
1. Base the verdict on the criteria text and recruiting locations. If the
   criteria are silent on a factor (e.g. lab cutoffs), prefer "unclear"
   over guessing.
2. Geographic graduation (patients can travel within a country):
   - At least one site in the patient's state AND clinical criteria pass
     → "likely_fit".
   - Sites only in OTHER states of the patient's country, criteria pass
     → "unclear" with a one-line note that travel would be required.
   - No site in the patient's country
     → "likely_ineligible" citing the location mismatch.
   - Patient location unknown → ignore location, judge on criteria alone.
3. Clinical-criteria ineligibility (age out of range, sex mismatch,
   excluded condition or medication) overrides location and returns
   "likely_ineligible" citing the criteria.
4. The reason MUST be one short sentence (under 25 words). No bullet lists.
5. Never fabricate patient details. Cite only what's in the patient summary.
6. Return verdicts for every NCT id you are given.`;

const RESPONSE_SCHEMA: SchemaUnion = {
  type: Type.OBJECT,
  properties: {
    verdicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nctId: { type: Type.STRING },
          verdict: {
            type: Type.STRING,
            enum: ['likely_fit', 'unclear', 'likely_ineligible'],
          },
          reason: { type: Type.STRING },
        },
        required: ['nctId', 'verdict', 'reason'],
      },
    },
  },
  required: ['verdicts'],
};

const VerdictsResponseSchema = z.object({
  verdicts: z.array(
    z.object({
      nctId: z.string().min(1),
      verdict: z.enum(['likely_fit', 'unclear', 'likely_ineligible']),
      reason: z.string().min(1),
    }),
  ),
});

export interface PatientSummary {
  age?: number;
  sex?: string;
  /** State / region from FHIR Patient.address[0].state. */
  state?: string;
  /** Country from FHIR Patient.address[0].country. */
  country?: string;
  conditions: string[];
  activeMedications: string[];
}

function formatTrialLocations(
  locations: TrialMatch['locations'],
): string {
  if (!locations || locations.length === 0) return 'no recruiting sites listed';
  return locations
    .slice(0, 5)
    .map((l) => [l.city, l.state, l.country].filter(Boolean).join(', ') || 'unknown')
    .join(' | ');
}

function buildPrompt(patient: PatientSummary, trials: TrialMatch[]): string {
  const sexLine = patient.sex ? `Sex: ${patient.sex}` : 'Sex: unknown';
  const ageLine = patient.age != null ? `Age: ${patient.age} years` : 'Age: unknown';
  const locLine =
    patient.state || patient.country
      ? `Location: ${[patient.state, patient.country].filter(Boolean).join(', ')}`
      : 'Location: unknown';
  const condLine =
    patient.conditions.length > 0
      ? `Active conditions: ${patient.conditions.join('; ')}`
      : 'Active conditions: none recorded';
  const medLine =
    patient.activeMedications.length > 0
      ? `Active medications: ${patient.activeMedications.join('; ')}`
      : 'Active medications: none recorded';

  const trialsBlock = trials
    .map(
      (t) =>
        `NCT ${t.nctId}\n  Title: ${t.briefTitle}\n  Eligibility ages: ${t.minAge ?? 'unspec'}–${t.maxAge ?? 'unspec'}\n  Eligibility sex: ${t.sex ?? 'ALL'}\n  Recruiting sites: ${formatTrialLocations(t.locations)}\n  Criteria: ${t.eligibilityCriteria ?? '(not provided)'}`,
    )
    .join('\n\n');

  return [
    'PATIENT SUMMARY:',
    ageLine,
    sexLine,
    locLine,
    condLine,
    medLine,
    '',
    'TRIALS:',
    trialsBlock,
    '',
    'Return a verdict + one-sentence reason for every NCT id above.',
  ].join('\n');
}

/**
 * Grades a batch of trials against a patient summary in a single Gemini call.
 * Falls back to undefined (no grading) when:
 *   - GEMINI_API_KEY is missing
 *   - the LLM call fails / times out
 *   - the response doesn't pass Zod validation
 *
 * Never throws — callers receive the trials unchanged on any failure.
 */
export async function gradeTrials(
  patient: PatientSummary,
  trials: TrialMatch[],
): Promise<TrialMatch[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || trials.length === 0) return trials;

  const gradableTrials = trials.filter((t) => t.eligibilityCriteria);
  if (gradableTrials.length === 0) return trials;

  const ai = new GoogleGenAI({ apiKey });
  const userPrompt = buildPrompt(patient, gradableTrials);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let rawText: string;
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
        abortSignal: controller.signal,
      },
    });
    rawText = response.text ?? '';
  } catch (err) {
    console.warn('[gradeTrials] LLM call failed:', err instanceof Error ? err.message : err);
    return trials;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!rawText) {
    console.warn('[gradeTrials] LLM returned empty text');
    return trials;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    console.warn('[gradeTrials] non-JSON output:', rawText.slice(0, 200));
    return trials;
  }

  const validated = VerdictsResponseSchema.safeParse(parsed);
  if (!validated.success) {
    console.warn('[gradeTrials] schema validation failed:', validated.error.issues.slice(0, 3));
    return trials;
  }

  const byId = new Map<string, { verdict: AiFitVerdict; reason: string }>();
  for (const v of validated.data.verdicts) {
    byId.set(v.nctId, { verdict: v.verdict, reason: v.reason });
  }

  return trials.map((t) => {
    const g = byId.get(t.nctId);
    return g ? { ...t, aiVerdict: g.verdict, aiReason: g.reason } : t;
  });
}
