import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { isOutOfRange, VITAL_RANGES } from '@/lib/vitalsUtils';
import { formatRelative } from '@/lib/dateUtils';

export function VitalCard({
  label,
  value,
  unit,
  vitalKey,
  recordedAt,
}: {
  label: string;
  value: number | undefined;
  unit?: string;
  vitalKey?: keyof typeof VITAL_RANGES | string;
  recordedAt?: string;
}) {
  const noData = value == null;
  const out = !noData && vitalKey ? isOutOfRange(vitalKey, value) : false;

  const borderClass = noData
    ? 'border-slate-200'
    : out
      ? 'border-red-300'
      : 'border-emerald-200';
  const textClass = noData ? 'text-slate-400' : out ? 'text-red-700' : 'text-slate-900';

  return (
    <div className={`rounded-lg border bg-white p-3 ${borderClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {!noData &&
          (out ? (
            <AlertCircle className="h-3.5 w-3.5 text-red-600" aria-label="Out of range" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-label="In range" />
          ))}
      </div>
      <p className={`mt-1 text-xl font-semibold ${textClass}`}>
        {noData ? 'No data' : `${formatValue(value)}${unit ? ` ${unit}` : ''}`}
      </p>
      {recordedAt && !noData && (
        <p className="mt-0.5 text-[11px] text-slate-400">Recorded {formatRelative(recordedAt)}</p>
      )}
    </div>
  );
}

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}
