import { AlertTriangle, Clock, CheckCircle2, Users, type LucideIcon } from 'lucide-react';
import type { DashboardKpis } from '@/lib/dashboardUtils';

function Tile({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: 'red' | 'amber' | 'emerald' | 'slate';
  hint?: string;
}) {
  const tones: Record<typeof tone, { bg: string; text: string; iconBg: string; iconColor: string }> = {
    red:     { bg: 'bg-red-50',     text: 'text-red-900',     iconBg: 'bg-red-100',     iconColor: 'text-red-700' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-900',   iconBg: 'bg-amber-100',   iconColor: 'text-amber-700' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-900', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' },
    slate:   { bg: 'bg-slate-50',   text: 'text-slate-900',   iconBg: 'bg-slate-100',   iconColor: 'text-slate-700' },
  };
  const t = tones[tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-slate-200 ${t.bg} p-4`}>
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${t.iconBg}`}>
        <Icon className={`h-4 w-4 ${t.iconColor}`} aria-hidden={true} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-2xl font-bold leading-none ${t.text}`}>{value}</p>
        <p className={`mt-1 text-xs font-medium ${t.text}`}>{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export function KpiTiles({ kpis, isLoading }: { kpis: DashboardKpis; isLoading: boolean }) {
  const v = (n: number) => (isLoading ? '…' : n);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile
        label="Needs review"
        value={v(kpis.needsReview)}
        icon={AlertTriangle}
        tone="amber"
        hint="Active prescriptions awaiting PA"
      />
      <Tile
        label="Overdue"
        value={v(kpis.overdue)}
        icon={Clock}
        tone="red"
        hint="Unsubmitted ≥ 7 days"
      />
      <Tile
        label="Submitted"
        value={v(kpis.submittedTotal)}
        icon={CheckCircle2}
        tone="emerald"
        hint="PA audit records on file"
      />
      <Tile
        label="Patients"
        value={v(kpis.patientCount)}
        icon={Users}
        tone="slate"
        hint="On panel"
      />
    </div>
  );
}
