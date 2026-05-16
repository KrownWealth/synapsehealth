import type { RiskTier } from './scoring';

export const RISK_CONFIG: Record<RiskTier, {
  label: string;
  action: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
}> = {
  critical: { label: 'Critical', action: 'Immediate emergency response required', bgClass: 'bg-red-50',    textClass: 'text-red-900',    borderClass: 'border-red-300',    dotClass: 'bg-red-500' },
  high:     { label: 'High',     action: 'Urgent review within 30 minutes',       bgClass: 'bg-orange-50', textClass: 'text-orange-900', borderClass: 'border-orange-300', dotClass: 'bg-orange-500' },
  medium:   { label: 'Medium',   action: 'Increase monitoring frequency',         bgClass: 'bg-amber-50',  textClass: 'text-amber-900',  borderClass: 'border-amber-300',  dotClass: 'bg-amber-500' },
  low:      { label: 'Low',      action: 'Routine monitoring',                    bgClass: 'bg-green-50',  textClass: 'text-green-900',  borderClass: 'border-green-300',  dotClass: 'bg-green-500' },
};

export const TIER_RANK: Record<RiskTier, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};
