'use client';

import type { ReactNode } from 'react';
import { entriesFromBundle } from '@/lib/patientUtils';
import { formatDate } from '@/lib/dateUtils';
import { IpsSectionCard } from '../IpsSectionCard';
import { Pill, statusTone } from './Pill';

function codeText(cc: fhir4.CodeableConcept | undefined): string | undefined {
  if (!cc) return undefined;
  return cc.text ?? cc.coding?.find((c) => c.display)?.display ?? cc.coding?.[0]?.code;
}

function firstCode(cc: fhir4.CodeableConcept | undefined, systemHint?: string): string | undefined {
  if (systemHint) {
    const hit = cc?.coding?.find((c) => c.system?.includes(systemHint))?.code;
    if (hit) return hit;
  }
  return cc?.coding?.[0]?.code;
}

interface BundleProps {
  bundle: fhir4.Bundle | undefined;
  isLoading?: boolean;
  error?: unknown;
}

// Shared cell styles. Edge cells (first/last) get extra padding so content
// doesn't kiss the card walls; inter-column gap is `pr-4`.
const TH_CLASS =
  'py-2.5 pr-4 first:pl-5 last:pr-5 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500';
const TD_CLASS = 'py-3 pr-4 first:pl-5 last:pr-5 align-top';
const ROW_CLASS = 'border-b border-slate-200 last:border-0';
const THEAD_CLASS = 'sticky top-0 z-10 bg-slate-50';

// ────────────────────────────────────────────────────────────────────────────
// Medications

export function MedicationsSection({
  bundle,
  isLoading,
  error,
  renderAction,
}: BundleProps & { renderAction?: (m: fhir4.MedicationRequest) => ReactNode }) {
  const meds = entriesFromBundle(bundle).filter(
    (r): r is fhir4.MedicationRequest => r.resourceType === 'MedicationRequest',
  );

  return (
    <IpsSectionCard
      title="Medications"
      loinc="LOINC 10160-0"
      count={meds.length}
      isLoading={isLoading}
      error={error}
    >
      <table className="min-w-full text-sm">
        <thead className={THEAD_CLASS}>
          <tr className="border-b border-slate-200">
            <Th>Medication</Th>
            <Th>Status</Th>
            <Th>Dose</Th>
            <Th>Authored</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {meds.map((m) => {
            const rxnorm = firstCode(m.medicationCodeableConcept, 'rxnorm');
            return (
              <tr key={m.id} className={ROW_CLASS}>
                <td className={TD_CLASS}>
                  <p className="font-medium text-slate-900">
                    {codeText(m.medicationCodeableConcept) ?? 'Medication'}
                  </p>
                  {rxnorm && <p className="mt-0.5 text-[11px] text-slate-500">RxNorm: {rxnorm}</p>}
                </td>
                <td className={TD_CLASS}>
                  {m.status && <Pill tone={statusTone(m.status)}>{m.status}</Pill>}
                </td>
                <td className={`${TD_CLASS} text-slate-700`}>
                  {m.dosageInstruction?.[0]?.text ?? <span className="text-slate-400">—</span>}
                </td>
                <td className={`${TD_CLASS} text-slate-700`}>{formatDate(m.authoredOn)}</td>
                <td className={TD_CLASS}>{renderAction?.(m)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </IpsSectionCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Observations (Labs / Vital signs)

export function ObservationsSection({ bundle, isLoading, error }: BundleProps) {
  const obs = entriesFromBundle(bundle).filter(
    (r): r is fhir4.Observation => r.resourceType === 'Observation',
  );

  return (
    <IpsSectionCard
      title="Observations"
      loinc="LOINC 30954-2"
      count={obs.length}
      isLoading={isLoading}
      error={error}
    >
      <table className="min-w-full text-sm">
        <thead className={THEAD_CLASS}>
          <tr className="border-b border-slate-200">
            <Th>Test</Th>
            <Th>Value</Th>
            <Th>Reference</Th>
            <Th>Interpretation</Th>
            <Th>Date</Th>
          </tr>
        </thead>
        <tbody>
          {obs.map((o) => {
            const loinc = firstCode(o.code, 'loinc');
            const value =
              o.valueQuantity?.value != null
                ? `${o.valueQuantity.value}${o.valueQuantity.unit ? ' ' + o.valueQuantity.unit : ''}`
                : (o.valueString ?? codeText(o.valueCodeableConcept) ?? '—');
            const range = o.referenceRange?.[0];
            const rangeText =
              range?.text ??
              (range?.low?.value != null && range?.high?.value != null
                ? `${range.low.value}–${range.high.value}${range.high.unit ? ' ' + range.high.unit : ''}`
                : '—');
            const interp = o.interpretation?.[0]?.coding?.[0];
            const interpLabel =
              interp?.code === 'H' || interp?.code === 'HH'
                ? 'High'
                : interp?.code === 'L' || interp?.code === 'LL'
                  ? 'Low'
                  : interp?.code === 'N'
                    ? 'Normal'
                    : interp?.display;
            const interpTone =
              interp?.code === 'H' || interp?.code === 'L' || interp?.code === 'HH' || interp?.code === 'LL'
                ? 'red'
                : interp?.code === 'N'
                  ? 'emerald'
                  : 'slate';
            return (
              <tr key={o.id} className={ROW_CLASS}>
                <td className={TD_CLASS}>
                  <p className="font-medium text-slate-900">{codeText(o.code) ?? 'Observation'}</p>
                  {loinc && <p className="mt-0.5 text-[11px] text-slate-500">LOINC: {loinc}</p>}
                </td>
                <td className={`${TD_CLASS} text-slate-900`}>{value}</td>
                <td className={`${TD_CLASS} text-slate-700`}>{rangeText}</td>
                <td className={TD_CLASS}>
                  {interpLabel && <Pill tone={interpTone}>{interpLabel}</Pill>}
                </td>
                <td className={`${TD_CLASS} text-slate-700`}>{formatDate(o.effectiveDateTime)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </IpsSectionCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Immunizations

export function ImmunizationsSection({ bundle, isLoading, error }: BundleProps) {
  const imms = entriesFromBundle(bundle).filter(
    (r): r is fhir4.Immunization => r.resourceType === 'Immunization',
  );

  return (
    <IpsSectionCard
      title="Immunizations"
      loinc="LOINC 11369-6"
      count={imms.length}
      isLoading={isLoading}
      error={error}
    >
      <table className="min-w-full text-sm">
        <thead className={THEAD_CLASS}>
          <tr className="border-b border-slate-200">
            <Th>Vaccine</Th>
            <Th>Status</Th>
            <Th>Date</Th>
          </tr>
        </thead>
        <tbody>
          {imms.map((i) => (
            <tr key={i.id} className={ROW_CLASS}>
              <td className={TD_CLASS}>
                <p className="font-medium text-slate-900">{codeText(i.vaccineCode) ?? 'Vaccine'}</p>
              </td>
              <td className={TD_CLASS}>
                {i.status && <Pill tone={statusTone(i.status)}>{i.status}</Pill>}
              </td>
              <td className={`${TD_CLASS} text-slate-700`}>{formatDate(i.occurrenceDateTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </IpsSectionCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Encounters

export function EncountersSection({ bundle, isLoading, error }: BundleProps) {
  const encs = entriesFromBundle(bundle).filter(
    (r): r is fhir4.Encounter => r.resourceType === 'Encounter',
  );

  return (
    <IpsSectionCard
      title="Encounters"
      loinc="LOINC 46240-8"
      count={encs.length}
      isLoading={isLoading}
      error={error}
    >
      <table className="min-w-full text-sm">
        <thead className={THEAD_CLASS}>
          <tr className="border-b border-slate-200">
            <Th>Type</Th>
            <Th>Class</Th>
            <Th>Period</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {encs.map((e) => {
            const type = e.type?.[0] ? codeText(e.type[0]) : undefined;
            const cls = e.class?.display ?? e.class?.code;
            const start = e.period?.start;
            const end = e.period?.end;
            return (
              <tr key={e.id} className={ROW_CLASS}>
                <td className={TD_CLASS}>
                  <p className="font-medium text-slate-900">{type ?? cls ?? 'Encounter'}</p>
                </td>
                <td className={`${TD_CLASS} text-slate-700`}>{cls ?? '—'}</td>
                <td className={`${TD_CLASS} text-slate-700`}>
                  {start ? formatDate(start) : '—'}
                  {end && end !== start ? ` → ${formatDate(end)}` : ''}
                </td>
                <td className={TD_CLASS}>
                  {e.status && <Pill tone={statusTone(e.status)}>{e.status}</Pill>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </IpsSectionCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Procedures

export function ProceduresSection({ bundle, isLoading, error }: BundleProps) {
  const procs = entriesFromBundle(bundle).filter(
    (r): r is fhir4.Procedure => r.resourceType === 'Procedure',
  );

  return (
    <IpsSectionCard
      title="Procedures"
      loinc="LOINC 47519-4"
      count={procs.length}
      isLoading={isLoading}
      error={error}
    >
      <table className="min-w-full text-sm">
        <thead className={THEAD_CLASS}>
          <tr className="border-b border-slate-200">
            <Th>Procedure</Th>
            <Th>Status</Th>
            <Th>Performed</Th>
          </tr>
        </thead>
        <tbody>
          {procs.map((p) => {
            const performed = p.performedDateTime ?? p.performedPeriod?.start;
            return (
              <tr key={p.id} className={ROW_CLASS}>
                <td className={TD_CLASS}>
                  <p className="font-medium text-slate-900">{codeText(p.code) ?? 'Procedure'}</p>
                </td>
                <td className={TD_CLASS}>
                  {p.status && <Pill tone={statusTone(p.status)}>{p.status}</Pill>}
                </td>
                <td className={`${TD_CLASS} text-slate-700`}>{formatDate(performed)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </IpsSectionCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Diagnostic reports

export function DiagnosticReportsSection({ bundle, isLoading, error }: BundleProps) {
  const reports = entriesFromBundle(bundle).filter(
    (r): r is fhir4.DiagnosticReport => r.resourceType === 'DiagnosticReport',
  );

  return (
    <IpsSectionCard
      title="Diagnostic Reports"
      loinc="LOINC 30954-2"
      count={reports.length}
      isLoading={isLoading}
      error={error}
    >
      <table className="min-w-full text-sm">
        <thead className={THEAD_CLASS}>
          <tr className="border-b border-slate-200">
            <Th>Report</Th>
            <Th>Conclusion</Th>
            <Th>Status</Th>
            <Th>Date</Th>
          </tr>
        </thead>
        <tbody>
          {reports.map((d) => (
            <tr key={d.id} className={ROW_CLASS}>
              <td className={TD_CLASS}>
                <p className="font-medium text-slate-900">{codeText(d.code) ?? 'Report'}</p>
              </td>
              <td className={`${TD_CLASS} text-slate-700`}>
                {d.conclusion ?? <span className="text-slate-400">—</span>}
              </td>
              <td className={TD_CLASS}>
                {d.status && <Pill tone={statusTone(d.status)}>{d.status}</Pill>}
              </td>
              <td className={`${TD_CLASS} text-slate-700`}>{formatDate(d.effectiveDateTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </IpsSectionCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Claims

export function ClaimsSection({ bundle, isLoading, error }: BundleProps) {
  const claims = entriesFromBundle(bundle).filter(
    (r): r is fhir4.Claim => r.resourceType === 'Claim',
  );

  return (
    <IpsSectionCard
      title="Claims"
      count={claims.length}
      isLoading={isLoading}
      error={error}
    >
      <table className="min-w-full text-sm">
        <thead className={THEAD_CLASS}>
          <tr className="border-b border-slate-200">
            <Th>Type</Th>
            <Th>Use</Th>
            <Th>Status</Th>
            <Th>Total</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => {
            const total =
              c.total?.value != null
                ? `${c.total.value} ${c.total.currency ?? ''}`.trim()
                : '—';
            return (
              <tr key={c.id} className={ROW_CLASS}>
                <td className={`${TD_CLASS} text-slate-900`}>{codeText(c.type) ?? '—'}</td>
                <td className={`${TD_CLASS} text-slate-700`}>{c.use ?? '—'}</td>
                <td className={TD_CLASS}>
                  {c.status && <Pill tone={statusTone(c.status)}>{c.status}</Pill>}
                </td>
                <td className={`${TD_CLASS} text-slate-700`}>{total}</td>
                <td className={`${TD_CLASS} text-slate-700`}>
                  {formatDate(c.created ?? c.billablePeriod?.start)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </IpsSectionCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function Th({ children }: { children?: ReactNode }) {
  return <th className={TH_CLASS}>{children}</th>;
}
