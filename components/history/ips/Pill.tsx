import type { Tone } from '@/lib/historyExtract';

const TONE_CLASS: Record<Tone, string> = {
  red: 'bg-red-50 text-red-800 ring-red-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-800 ring-blue-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
};

export function Pill({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

export function CodeBox({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-block rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
      {children}
    </code>
  );
}

function severityTone(sev: string | undefined): Tone {
  const s = sev?.toLowerCase() ?? '';
  if (s.includes('severe') || s === 'high') return 'red';
  if (s.includes('moderate') || s.includes('mild') || s === 'low') return 'amber';
  if (s === 'normal') return 'emerald';
  return 'slate';
}

function statusTone(status: string | undefined): Tone {
  const s = status?.toLowerCase() ?? '';
  if (s === 'active' || s === 'confirmed' || s === 'completed' || s === 'final') return 'emerald';
  if (s === 'draft' || s === 'preliminary' || s === 'entered-in-error') return 'amber';
  return 'slate';
}

export { severityTone, statusTone };
