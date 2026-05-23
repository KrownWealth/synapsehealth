'use client';

import { Activity, AlertTriangle, ClipboardList, FlaskConical, Pill, Stethoscope } from 'lucide-react';
import { entriesFromBundle } from '@/lib/patientUtils';
import { extractRow } from '@/lib/historyExtract';
import { formatDate, formatRelative } from '@/lib/dateUtils';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import type { LucideIcon } from 'lucide-react';

function Card({
  icon: Icon,
  label,
  count,
  tone = 'slate',
  children,
}: {
  icon: LucideIcon;
  label: string;
  count?: number | string;
  tone?: 'slate' | 'amber' | 'emerald' | 'indigo' | 'red';
  children: React.ReactNode;
}) {
  const tones = {
    slate:   { bg: 'bg-slate-50', iconBg: 'bg-slate-100', iconText: 'text-slate-600' },
    amber:   { bg: 'bg-amber-50/40', iconBg: 'bg-amber-100', iconText: 'text-amber-700' },
    emerald: { bg: 'bg-emerald-50/40', iconBg: 'bg-emerald-100', iconText: 'text-emerald-700' },
    indigo:  { bg: 'bg-indigo-50/40', iconBg: 'bg-indigo-100', iconText: 'text-indigo-700' },
    red:     { bg: 'bg-red-50/40', iconBg: 'bg-red-100', iconText: 'text-red-700' },
  } as const;
  const t = tones[tone];

  return (
    <div className={`flex flex-col gap-2 rounded-xl border border-slate-200 ${t.bg} p-4`}>
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${t.iconBg}`}>
          <Icon className={`h-4 w-4 ${t.iconText}`} aria-hidden={true} />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {count != null && (
          <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            {count}
          </span>
        )}
      </div>
      <div className="flex-1 text-sm text-slate-800">{children}</div>
    </div>
  );
}

function Bullets({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-xs text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((s, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
          <span className="truncate text-slate-800">{s}</span>
        </li>
      ))}
    </ul>
  );
}

export function OverviewTab({
  conditions,
  medications,
  allergies,
  encounters,
  observations,
  isLoading,
}: {
  conditions: fhir4.Bundle | undefined;
  medications: fhir4.Bundle | undefined;
  allergies: fhir4.Bundle | undefined;
  encounters: fhir4.Bundle | undefined;
  observations: fhir4.Bundle | undefined;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const activeConditions = entriesFromBundle(conditions)
    .filter((r): r is fhir4.Condition => r.resourceType === 'Condition')
    .filter((c) => {
      const code = c.clinicalStatus?.coding?.[0]?.code;
      return !code || code === 'active' || code === 'recurrence' || code === 'relapse';
    });
  const conditionNames = activeConditions
    .slice(0, 3)
    .map((c) => extractRow(c).title);

  const activeMeds = entriesFromBundle(medications)
    .filter((r): r is fhir4.MedicationRequest => r.resourceType === 'MedicationRequest')
    .filter((m) => m.status === 'active')
    .sort((a, b) => (b.authoredOn ?? '').localeCompare(a.authoredOn ?? ''));
  const medNames = activeMeds.slice(0, 3).map((m) => extractRow(m).title);

  const allergyList = entriesFromBundle(allergies)
    .filter((r): r is fhir4.AllergyIntolerance => r.resourceType === 'AllergyIntolerance');
  const allergyNames = allergyList.slice(0, 3).map((a) => extractRow(a).title);

  const lastEncounter = entriesFromBundle(encounters)
    .filter((r): r is fhir4.Encounter => r.resourceType === 'Encounter')
    .sort((a, b) => (b.period?.start ?? '').localeCompare(a.period?.start ?? ''))[0];

  const recentLabs = entriesFromBundle(observations)
    .filter((r): r is fhir4.Observation => r.resourceType === 'Observation')
    .filter((o) =>
      o.category?.some((c) => c.coding?.some((cc) => cc.code === 'laboratory'))
    )
    .sort((a, b) => (b.effectiveDateTime ?? '').localeCompare(a.effectiveDateTime ?? ''))
    .slice(0, 3);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        icon={Stethoscope}
        label="Active conditions"
        count={activeConditions.length}
        tone="indigo"
      >
        <Bullets items={conditionNames} empty="No active conditions on record." />
      </Card>

      <Card icon={Pill} label="Active medications" count={activeMeds.length} tone="emerald">
        <Bullets items={medNames} empty="No active medications." />
      </Card>

      <Card
        icon={AlertTriangle}
        label="Allergies"
        count={allergyList.length}
        tone={allergyList.length > 0 ? 'red' : 'slate'}
      >
        <Bullets items={allergyNames} empty="No known allergies." />
      </Card>

      <Card icon={Activity} label="Last encounter" tone="slate">
        {lastEncounter ? (
          <div className="space-y-0.5">
            <p className="text-sm text-slate-900">
              {extractRow(lastEncounter).title}
            </p>
            <p className="text-xs text-slate-500">
              {lastEncounter.period?.start ? formatDate(lastEncounter.period.start) : 'date unknown'}
              {lastEncounter.serviceProvider?.display
                ? ` · ${lastEncounter.serviceProvider.display}`
                : ''}
            </p>
            {lastEncounter.period?.start && (
              <p className="text-[11px] text-slate-400">{formatRelative(lastEncounter.period.start)}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No encounters on record.</p>
        )}
      </Card>

      <Card
        icon={FlaskConical}
        label="Recent labs"
        count={recentLabs.length}
        tone="slate"
      >
        {recentLabs.length === 0 ? (
          <p className="text-xs text-slate-500">No labs on record.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {recentLabs.map((o) => {
              const row = extractRow(o);
              return (
                <li key={o.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="truncate font-medium text-slate-900">{row.title}</span>
                  {row.valueLine && (
                    <span className="text-xs text-slate-600">{row.valueLine.split(' · ')[0]}</span>
                  )}
                  {row.secondaryPill && row.secondaryPill.tone === 'red' && (
                    <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                      {row.secondaryPill.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card icon={ClipboardList} label="Coverage" tone="slate">
        <p className="text-xs text-slate-500">
          Insurance is auto-resolved on PA submission. Open the Prior Auth detail for the payer
          of record.
        </p>
      </Card>
    </div>
  );
}
