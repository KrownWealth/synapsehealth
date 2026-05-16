import { Check, X } from 'lucide-react';
import type { SirsResult } from '@/lib/scoring';

export function SirsScore({ result }: { result: SirsResult }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-900">
          SIRS <span className="text-xs font-normal text-slate-400">(3-parameter)</span>
        </p>
        <p className="text-2xl font-bold text-slate-900">
          {result.score}
          <span className="text-sm font-normal text-slate-500">/3</span>
        </p>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">SIRS met if ≥ 2</p>
      <ul className="mt-3 space-y-1.5">
        {result.criteria.map((c) => (
          <li key={c.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5">
              {c.met ? (
                <Check className="h-3.5 w-3.5 text-amber-700" aria-label="Met" />
              ) : (
                <X className="h-3.5 w-3.5 text-slate-300" aria-label="Not met" />
              )}
              <span className={c.met ? 'font-medium text-slate-900' : 'text-slate-600'}>{c.label}</span>
            </span>
            <span className="font-mono text-slate-500">{c.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
