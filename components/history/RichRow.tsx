'use client';

import type { ReactNode } from 'react';
import type { RowChip, RowData, Tone } from '@/lib/historyExtract';

const TONE_CLASS: Record<Tone, string> = {
  red: 'bg-red-50 text-red-800 ring-red-100',
  amber: 'bg-amber-50 text-amber-900 ring-amber-100',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-800 ring-blue-100',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
};

function Pill({ chip }: { chip: RowChip }) {
  const tone = chip.tone ?? 'slate';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${TONE_CLASS[tone]}`}
    >
      {chip.label}
    </span>
  );
}

export function RichRow({ row, action }: { row: RowData; action?: ReactNode }) {
  return (
    <li className="border-b border-slate-100 last:border-0">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="truncate text-sm font-medium text-slate-900">{row.title}</p>
              {row.codeChip && (
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                  {row.codeChip}
                </code>
              )}
            </div>
            {row.valueLine && (
              <p className="mt-1 text-sm text-slate-700">{row.valueLine}</p>
            )}
            {row.dateLine && (
              <p className="mt-0.5 text-xs text-slate-500">{row.dateLine}</p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {row.secondaryPill && <Pill chip={row.secondaryPill} />}
            {row.statusPill && <Pill chip={row.statusPill} />}
            {action}
          </div>
        </div>
      </div>
    </li>
  );
}
