'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { buildVitalsTrend } from '@/lib/vitalsUtils';
import { useVitalsTrend } from '@/hooks/useObservations';
import { EmptyState } from '@/components/ui/EmptyState';

export function VitalsTrendChart({ patientId }: { patientId: string }) {
  const { data, isLoading } = useVitalsTrend(patientId);

  const points = useMemo(() => (data ? buildVitalsTrend(data) : []), [data]);

  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-lg bg-slate-100" />;
  }

  if (points.length < 2) {
    return (
      <EmptyState
        title="Insufficient trend data"
        message="At least two observations in the last 24 hours are needed to render a trend."
      />
    );
  }

  const chartData = points.map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    Heart: p.heartRate ?? null,
    Resp: p.respiratoryRate ?? null,
    SBP: p.systolicBP ?? null,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
            labelStyle={{ color: '#475569' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={22} stroke="#dc2626" strokeDasharray="4 4" label={{ value: 'RR 22', fontSize: 10, fill: '#dc2626', position: 'right' }} />
          <ReferenceLine y={100} stroke="#ea580c" strokeDasharray="4 4" label={{ value: 'SBP 100', fontSize: 10, fill: '#ea580c', position: 'right' }} />
          <Line type="monotone" dataKey="Heart" stroke="#0f766e" strokeWidth={2} dot={{ r: 2 }} connectNulls />
          <Line type="monotone" dataKey="Resp" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} connectNulls />
          <Line type="monotone" dataKey="SBP" stroke="#9333ea" strokeWidth={2} dot={{ r: 2 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
