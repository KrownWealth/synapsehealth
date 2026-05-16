import { AlertTriangle } from 'lucide-react';
import type { SepsisScore } from '@/lib/scoring';
import { RISK_CONFIG } from '@/lib/riskConfig';
import { RiskBadge } from './RiskBadge';
import { QsofaScore } from './QsofaScore';
import { SirsScore } from './SirsScore';
import { News2Score } from './News2Score';

export function SepsisRiskPanel({
  score,
  antibioticActive,
  spo2Missing,
}: {
  score: SepsisScore;
  antibioticActive?: boolean;
  spo2Missing?: boolean;
}) {
  const cfg = RISK_CONFIG[score.tier];
  const prominent = score.tier === 'critical' || score.tier === 'high';

  return (
    <section
      aria-labelledby="risk-panel-heading"
      className={`rounded-xl border-2 ${prominent ? cfg.borderClass : 'border-slate-200'} ${cfg.bgClass}`}
    >
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {prominent && <AlertTriangle className={`h-6 w-6 flex-shrink-0 ${cfg.textClass}`} aria-hidden="true" />}
          <div>
            <h2 id="risk-panel-heading" className="text-base font-semibold text-slate-900">
              Sepsis Risk
            </h2>
            <p className={`mt-0.5 text-sm ${cfg.textClass}`}>{cfg.action}</p>
            {antibioticActive && (
              <p className="mt-1 text-xs text-teal-800">Antibiotic therapy in progress</p>
            )}
            {spo2Missing && (
              <p className="mt-1 text-xs text-slate-600">SpO₂ not recorded — NEWS2 partial</p>
            )}
          </div>
        </div>
        <RiskBadge tier={score.tier} size="md" />
      </div>

      <div className="grid gap-3 p-5 pt-0 sm:grid-cols-3">
        <QsofaScore result={score.qsofa} />
        <SirsScore result={score.sirs} />
        <News2Score result={score.news2} />
      </div>
    </section>
  );
}
