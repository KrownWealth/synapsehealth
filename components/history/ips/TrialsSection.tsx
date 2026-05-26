'use client';

import { ExternalLink, Info, Sparkles } from 'lucide-react';
import { IpsSectionCard } from '../IpsSectionCard';
import { Pill, statusTone } from './Pill';
import { useClinicalTrials } from '@/hooks/useClinicalTrials';
import type { AiFitVerdict, TrialMatch } from '@/lib/clinicalTrials';
import type { Tone } from '@/lib/historyExtract';

const VERDICT_TONE: Record<AiFitVerdict, Tone> = {
  likely_fit: 'emerald',
  unclear: 'amber',
  likely_ineligible: 'red',
};

const VERDICT_LABEL: Record<AiFitVerdict, string> = {
  likely_fit: 'Likely fit',
  unclear: 'Unclear',
  likely_ineligible: 'Likely ineligible',
};

const TH_CLASS =
  'py-2.5 pr-4 first:pl-5 last:pr-5 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500';
const TD_CLASS = 'py-3 pr-4 first:pl-5 last:pr-5 align-top';

function ageRangeText(min?: number, max?: number): string {
  if (min == null && max == null) return '—';
  const minTxt = min == null ? '0' : Math.round(min).toString();
  const maxTxt = max == null ? '∞' : Math.round(max).toString();
  return `${minTxt}–${maxTxt} yrs`;
}

function locationText(
  locations: Array<{ city?: string; state?: string; country?: string }>,
): string {
  if (locations.length === 0) return '—';
  const first = locations[0];
  const place = [first.city, first.state].filter(Boolean).join(', ');
  if (locations.length === 1) return place || first.country || '—';
  return `${place || first.country || '—'} +${locations.length - 1} more`;
}

function FitCell({ trial }: { trial: TrialMatch }) {
  if (!trial.aiVerdict) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className="space-y-1">
      <div className="inline-flex items-center gap-1">
        <Sparkles className="h-3 w-3 text-indigo-500" aria-hidden={true} />
        <Pill tone={VERDICT_TONE[trial.aiVerdict]}>{VERDICT_LABEL[trial.aiVerdict]}</Pill>
      </div>
      {trial.aiReason && (
        <p className="max-w-[260px] text-[11px] leading-snug text-slate-600">{trial.aiReason}</p>
      )}
    </div>
  );
}

export function TrialsSection({ patientId }: { patientId: string }) {
  const { data, isLoading, error } = useClinicalTrials(patientId);
  const trials = data?.trials ?? [];
  const hasAi = trials.some((t) => t.aiVerdict);

  return (
    <IpsSectionCard
      title="Clinical Trial Matches"
      loinc="Source · ClinicalTrials.gov"
      count={trials.length}
      isLoading={isLoading}
      error={error}
      emptyTitle="No recruiting trials matched"
    >
      <div>
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className={TH_CLASS}>Trial</th>
              <th className={TH_CLASS}>Status</th>
              <th className={TH_CLASS}>Ages</th>
              <th className={TH_CLASS}>Sex</th>
              <th className={TH_CLASS}>AI fit</th>
              <th className={TH_CLASS}>Locations</th>
              <th className={TH_CLASS}></th>
            </tr>
          </thead>
          <tbody>
            {trials.map((t) => (
              <tr key={t.nctId} className="border-b border-slate-200 last:border-0">
                <td className={TD_CLASS}>
                  <p className="font-medium text-slate-900">{t.briefTitle}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    <span className="font-mono">{t.nctId}</span>
                    {t.matchedCondition && (
                      <>
                        {' · matched on '}
                        <span className="text-slate-700">{t.matchedCondition}</span>
                      </>
                    )}
                  </p>
                </td>
                <td className={TD_CLASS}>
                  <Pill tone={statusTone(t.status.toLowerCase().replace('_', '-'))}>
                    {t.status.toLowerCase().replace('_', ' ')}
                  </Pill>
                </td>
                <td className={`${TD_CLASS} text-slate-700`}>{ageRangeText(t.minAge, t.maxAge)}</td>
                <td className={`${TD_CLASS} text-slate-700`}>
                  {t.sex ? t.sex.toLowerCase() : '—'}
                </td>
                <td className={TD_CLASS}>
                  <FitCell trial={t} />
                </td>
                <td className={`${TD_CLASS} text-slate-700`}>{locationText(t.locations)}</td>
                <td className={TD_CLASS}>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Open <ExternalLink className="h-3 w-3" aria-hidden={true} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {trials.length > 0 && (
          <div className="flex items-start gap-2 border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-[11px] text-slate-500">
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden={true} />
            <p>
              {hasAi
                ? 'AI fit is an automated screening hint based on each trial’s eligibility text. Verify with the trial coordinator before referring a patient. Source: ClinicalTrials.gov.'
                : 'For screening only. Verify eligibility with the trial coordinator before referring a patient. Trial data from ClinicalTrials.gov.'}
            </p>
          </div>
        )}
      </div>
    </IpsSectionCard>
  );
}
