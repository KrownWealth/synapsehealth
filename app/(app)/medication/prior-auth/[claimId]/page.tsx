import Link from 'next/link';
import { ArrowLeft, CheckCircle2, User } from 'lucide-react';
import { fhirServerFetch, FhirError } from '@/lib/fhirServer';
import { formatDateTime } from '@/lib/dateUtils';
import { ErrorPanel } from '@/components/ui/ErrorPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prior Auth Detail — Synapse Health' };

function refTail(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const ix = ref.indexOf('/');
  return ix === -1 ? ref : ref.slice(ix + 1);
}

function refType(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const ix = ref.indexOf('/');
  return ix === -1 ? undefined : ref.slice(0, ix);
}

async function safeFetch<T>(path: string): Promise<T | null> {
  try {
    return await fhirServerFetch<T>(path);
  } catch {
    return null;
  }
}

export default async function PriorAuthDetailPage({
  params,
}: {
  params: { claimId: string };
}) {
  let claim: fhir4.Claim;
  try {
    claim = await fhirServerFetch<fhir4.Claim>(`/Claim/${params.claimId}`);
  } catch (err) {
    const status = err instanceof FhirError ? err.status : 500;
    return (
      <div className="space-y-4">
        <Link
          href="/medication/prior-auth"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Prior Auth
        </Link>
        <ErrorPanel
          title="Could not load Claim"
          message={`HTTP ${status} — ${params.claimId}`}
        />
      </div>
    );
  }

  if (claim.use !== 'preauthorization') {
    return (
      <div className="space-y-4">
        <Link
          href="/medication/prior-auth"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Prior Auth
        </Link>
        <ErrorPanel
          title="Not a prior-authorization Claim"
          message={`Claim/${params.claimId} has use="${claim.use}", not "preauthorization".`}
        />
      </div>
    );
  }

  const patientId = refTail(claim.patient?.reference);
  const coverageId = refTail(claim.insurance?.[0]?.coverage?.reference);

  const [patient, coverage] = await Promise.all([
    patientId ? safeFetch<fhir4.Patient>(`/Patient/${patientId}`) : Promise.resolve(null),
    coverageId ? safeFetch<fhir4.Coverage>(`/Coverage/${coverageId}`) : Promise.resolve(null),
  ]);

  const patientName = patient
    ? [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' ')
    : '—';

  const medication =
    claim.item?.[0]?.productOrService?.text ??
    claim.item?.[0]?.productOrService?.coding?.[0]?.display ??
    'Medication';
  const rxnorm = claim.item?.[0]?.productOrService?.coding?.find((c) =>
    c.system?.includes('rxnorm'),
  )?.code;

  const narrativeEntry = claim.supportingInfo?.find(
    (s) => s.category?.coding?.[0]?.code === 'clinical',
  );
  const citationEntries = (claim.supportingInfo ?? []).filter(
    (s) => s.category?.coding?.[0]?.code === 'info',
  );

  const payor = coverage?.payor?.[0]?.display ?? '—';
  const coverageType =
    coverage?.type?.coding?.[0]?.display ?? coverage?.type?.coding?.[0]?.code ?? '—';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/medication/prior-auth"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Prior Auth
        </Link>
        {patientId && (
          <Link
            href={`/patients/${patientId}`}
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          >
            <User className="h-4 w-4" /> View patient chart
          </Link>
        )}
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            <CheckCircle2 className="h-3 w-3" />
            Submitted
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            Pharmacy PA
          </span>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
            Da Vinci PAS
          </span>
        </div>
        <h1 className="text-lg md:text-xl lg:text-2xl font-semibold text-slate-900">{medication}</h1>
        <p className="text-sm text-slate-600">
          for <span className="font-medium text-slate-900">{patientName}</span>
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Meta label="Submitted" value={formatDateTime(claim.created)} />
        <Meta label="Practitioner" value={claim.provider?.display ?? '—'} />
        <Meta label="Payer" value={`${payor}${coverageType !== '—' ? ` (${coverageType})` : ''}`} />
        <Meta
          label="RxNorm"
          value={rxnorm ? <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{rxnorm}</code> : '—'}
        />
      </section>

      {narrativeEntry?.valueString && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Cover-letter narrative
          </h2>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {narrativeEntry.valueString}
            </p>
          </div>
        </section>
      )}

      {citationEntries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Citations ({citationEntries.length})
          </h2>
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {citationEntries.map((si, i) => {
              const ref = si.valueReference?.reference;
              const detail = si.valueReference?.display;
              const type = refType(ref);
              const id = refTail(ref);
              return (
                <li
                  key={`${ref}-${i}`}
                  className="flex flex-col md:flex-row items-start gap-3 border-b border-slate-100 px-3 py-2 last:border-0"
                >
                  <code className="flex-shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                    {type ?? 'Resource'}/{id?.slice(0, 8) ?? '?'}…
                  </code>
                  <p className="flex-1 text-sm text-slate-800">{detail ?? ref}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  );
}
