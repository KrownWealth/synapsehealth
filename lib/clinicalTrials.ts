import 'server-only';

/**
 * Thin wrapper around the public ClinicalTrials.gov v2 API.
 * Docs: https://clinicaltrials.gov/data-api/api
 *
 * Notes:
 *   - No auth required.
 *   - We only send de-identified data (condition display names, age, sex, optionally state).
 *     Patient names, MRNs, FHIR ids never leave our server.
 */

const CT_API = 'https://clinicaltrials.gov/api/v2/studies';
const CT_TIMEOUT_MS = 15_000;

export type AiFitVerdict = 'likely_fit' | 'unclear' | 'likely_ineligible';

export interface TrialMatch {
  nctId: string;
  briefTitle: string;
  briefSummary?: string;
  status: string;
  matchedCondition: string;
  conditions: string[];
  minAge?: number;
  maxAge?: number;
  sex?: 'ALL' | 'MALE' | 'FEMALE';
  /** Raw eligibility text (truncated). Used by the AI fit grader. */
  eligibilityCriteria?: string;
  locations: Array<{ facility?: string; city?: string; state?: string; country?: string; status?: string }>;
  url: string;
  /** Set by gradeTrials() when GEMINI_API_KEY is available. */
  aiVerdict?: AiFitVerdict;
  aiReason?: string;
}

interface CtStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    descriptionModule?: { briefSummary?: string };
    statusModule?: { overallStatus?: string };
    eligibilityModule?: {
      minimumAge?: string;
      maximumAge?: string;
      sex?: string;
      eligibilityCriteria?: string;
    };
    conditionsModule?: { conditions?: string[] };
    contactsLocationsModule?: {
      locations?: Array<{
        facility?: string;
        city?: string;
        state?: string;
        country?: string;
        status?: string;
      }>;
    };
  };
}

interface CtResponse {
  studies?: CtStudy[];
  nextPageToken?: string;
}

/**
 * Parse an age string like "18 Years" / "6 Months" / "N/A" into years.
 * Returns undefined when the value is missing or non-numeric.
 */
function parseAgeYears(raw: string | undefined): number | undefined {
  if (!raw || raw.toUpperCase() === 'N/A') return undefined;
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(Year|Month|Week|Day)s?/i);
  if (!match) return undefined;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'year':  return n;
    case 'month': return n / 12;
    case 'week':  return n / 52;
    case 'day':   return n / 365;
    default:      return undefined;
  }
}

function ageMatches(patientAge: number | undefined, minAge: number | undefined, maxAge: number | undefined): boolean {
  if (patientAge == null) return true; // can't filter — keep it
  if (minAge != null && patientAge < minAge) return false;
  if (maxAge != null && patientAge > maxAge) return false;
  return true;
}

function sexMatches(patientSex: string | undefined, studySex: string | undefined): boolean {
  if (!studySex || studySex === 'ALL') return true;
  if (!patientSex) return true; // can't filter
  return studySex.toUpperCase() === patientSex.toUpperCase();
}

async function searchOneCondition(condition: string, signal: AbortSignal): Promise<CtStudy[]> {
  const url = new URL(CT_API);
  url.searchParams.set('query.cond', condition);
  url.searchParams.set('filter.overallStatus', 'RECRUITING');
  url.searchParams.set('pageSize', '20');
  url.searchParams.set('format', 'json');
  url.searchParams.set(
    'fields',
    [
      'protocolSection.identificationModule.nctId',
      'protocolSection.identificationModule.briefTitle',
      'protocolSection.descriptionModule.briefSummary',
      'protocolSection.statusModule.overallStatus',
      'protocolSection.eligibilityModule.minimumAge',
      'protocolSection.eligibilityModule.maximumAge',
      'protocolSection.eligibilityModule.sex',
      'protocolSection.eligibilityModule.eligibilityCriteria',
      'protocolSection.conditionsModule.conditions',
      'protocolSection.contactsLocationsModule.locations',
    ].join(','),
  );

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal,
      next: { revalidate: 60 * 60 }, // CT.gov data is slow-moving — 1h server cache is fine
    });
    if (!res.ok) return [];
    const json = (await res.json()) as CtResponse;
    return json.studies ?? [];
  } catch {
    return [];
  }
}

export interface SearchClinicalTrialsInput {
  /** Condition display names lifted from FHIR Condition.code.text / coding[0].display. */
  conditions: string[];
  /** Patient age in years. */
  age?: number;
  /** FHIR Patient.gender (male / female / other / unknown). */
  sex?: string;
  /** Max trials in the final response. */
  maxResults?: number;
}

export async function searchClinicalTrials({
  conditions,
  age,
  sex,
  maxResults = 12,
}: SearchClinicalTrialsInput): Promise<TrialMatch[]> {
  if (conditions.length === 0) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CT_TIMEOUT_MS);

  try {
    // Query CT.gov for each condition in parallel. Some conditions can be very broad
    // (e.g. "Hypertension") and return 200+ trials; we cap each call at pageSize=20.
    const perCondition = await Promise.all(
      conditions.slice(0, 5).map(async (condition) => {
        const studies = await searchOneCondition(condition, controller.signal);
        return studies.map((s) => ({ studyRecord: s, matchedCondition: condition }));
      }),
    );

    const seen = new Map<string, TrialMatch>();
    for (const batch of perCondition) {
      for (const { studyRecord, matchedCondition } of batch) {
        const ps = studyRecord.protocolSection;
        const nctId = ps?.identificationModule?.nctId;
        if (!nctId || seen.has(nctId)) continue;

        const minAge = parseAgeYears(ps?.eligibilityModule?.minimumAge);
        const maxAge = parseAgeYears(ps?.eligibilityModule?.maximumAge);
        const studySex = ps?.eligibilityModule?.sex as 'ALL' | 'MALE' | 'FEMALE' | undefined;

        if (!ageMatches(age, minAge, maxAge)) continue;
        if (!sexMatches(sex, studySex)) continue;

        const rawCriteria = ps?.eligibilityModule?.eligibilityCriteria;
        seen.set(nctId, {
          nctId,
          briefTitle: ps?.identificationModule?.briefTitle ?? '(untitled study)',
          briefSummary: ps?.descriptionModule?.briefSummary,
          status: ps?.statusModule?.overallStatus ?? 'UNKNOWN',
          matchedCondition,
          conditions: ps?.conditionsModule?.conditions ?? [],
          minAge,
          maxAge,
          sex: studySex,
          eligibilityCriteria: rawCriteria
            ? rawCriteria.slice(0, 700) // truncate to keep LLM prompt tight
            : undefined,
          locations: (ps?.contactsLocationsModule?.locations ?? []).slice(0, 5),
          url: `https://clinicaltrials.gov/study/${nctId}`,
        });
      }
    }

    return Array.from(seen.values()).slice(0, maxResults);
  } finally {
    clearTimeout(timeoutId);
  }
}
