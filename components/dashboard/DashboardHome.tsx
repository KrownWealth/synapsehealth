'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { buildWorklist, computeKpis } from '@/lib/dashboardUtils';
import { patientsFromBundle } from '@/lib/patientUtils';
import { KpiTiles } from './KpiTiles';
import { PaWorklist } from './PaWorklist';
import { RecentActivity } from './RecentActivity';

export function DashboardHome() {
  const { patients, medications, preAuthClaims } = useDashboard();

  const items = useMemo(
    () => buildWorklist(patients.data, medications.data, preAuthClaims.data),
    [patients.data, medications.data, preAuthClaims.data],
  );
  const patientCount = useMemo(
    () => patientsFromBundle(patients.data).length,
    [patients.data],
  );
  const kpis = useMemo(() => computeKpis(items, patientCount), [items, patientCount]);

  const dashboardLoading =
    patients.isLoading || medications.isLoading || preAuthClaims.isLoading;
  const dashboardError = medications.error || preAuthClaims.error;
  const openCount = items.filter((i) => !i.submitted).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cross-patient overview of prior-auth work.
        </p>
      </header>

      <KpiTiles kpis={kpis} isLoading={dashboardLoading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <PaWorklist
            items={items}
            isLoading={dashboardLoading}
            error={dashboardError}
            limit={5}
            headingLabel="Most urgent (prior authorizations)"
          />
          {openCount > 5 && (
            <Link
              href="/medication/task-list"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              View full task list ({openCount}) <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        <div className="lg:col-span-2">
          <RecentActivity
            preAuthClaims={preAuthClaims.data}
            patients={patients.data}
            meds={medications.data}
            isLoading={dashboardLoading}
          />
        </div>
      </div>
    </div>
  );
}
