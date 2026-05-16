import type { News2Result } from '@/lib/scoring';

function pointsClass(points: number): string {
  if (points >= 3) return 'bg-red-100 text-red-900';
  if (points === 2) return 'bg-orange-100 text-orange-900';
  if (points === 1) return 'bg-amber-100 text-amber-900';
  return 'bg-slate-100 text-slate-600';
}

export function News2Score({ result }: { result: News2Result }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-900">NEWS2</p>
        <p className="text-2xl font-bold text-slate-900">
          {result.total}
          <span className="text-sm font-normal text-slate-500">/20</span>
        </p>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        {result.total >= 7
          ? 'High — emergency response'
          : result.total >= 5
            ? 'Medium — urgent review'
            : result.hasSingleParamAt3
              ? 'Medium — single parameter at 3'
              : 'Low — routine'}
      </p>
      <ul className="mt-3 space-y-1.5">
        {result.breakdown.map((b) => (
          <li key={b.parameter} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-700">{b.parameter}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-slate-500">{b.value}</span>
              <span
                className={`inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold ${pointsClass(b.points)}`}
              >
                +{b.points}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
