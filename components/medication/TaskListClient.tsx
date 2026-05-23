'use client';

import { useMemo } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { buildWorklist } from '@/lib/dashboardUtils';
import { PaWorklist } from '@/components/dashboard/PaWorklist';

export function TaskListClient() {
  const { patients, medications, preAuthClaims } = useDashboard();
  const items = useMemo(
    () => buildWorklist(patients.data, medications.data, preAuthClaims.data),
    [patients.data, medications.data, preAuthClaims.data],
  );

  const loading = patients.isLoading || medications.isLoading || preAuthClaims.isLoading;
  const error = medications.error || preAuthClaims.error;

  return (
    <PaWorklist
      items={items}
      isLoading={loading}
      error={error}
      headingLabel="Active prescriptions needing review"
      emptyTitle="Nothing to review"
      emptyMessage="Every active prescription on your panel has been processed."
    />
  );
}
