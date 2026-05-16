import type { RiskTier } from '@/lib/scoring';
import { RISK_CONFIG } from '@/lib/riskConfig';

export function RiskBadge({ tier, size = 'sm' }: { tier: RiskTier; size?: 'sm' | 'md' }) {
  const cfg = RISK_CONFIG[tier];
  const pad = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${pad} ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}
      aria-label={`Risk tier: ${cfg.label}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
