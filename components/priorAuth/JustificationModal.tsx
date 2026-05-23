'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useGeneratePriorAuth, useSubmitPriorAuth } from '@/hooks/usePriorAuth';
import { summarizeMedicationRequest } from '@/lib/resourceSummaries';
import type { GenerateResponse } from '@/hooks/usePriorAuth';

function RationaleBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-800">{body}</p>
    </div>
  );
}

function CitationsList({ citations }: { citations: GenerateResponse['justification']['citations'] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
      >
        <span className="text-xs font-medium text-slate-700">
          Citations ({citations.length})
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        )}
      </button>
      {open && (
        <ul className="divide-y divide-slate-100 border-t border-slate-200">
          {citations.map((c, i) => (
            <li key={`${c.resourceType}/${c.resourceId}/${i}`} className="px-3 py-2">
              <code className="text-[10px] text-slate-500">
                {c.resourceType}/{c.resourceId}
              </code>
              <p className="mt-0.5 text-xs text-slate-700">{c.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function JustificationModal({
  open,
  onClose,
  patientId,
  medicationRequest,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  medicationRequest: fhir4.MedicationRequest;
}) {
  const summary = summarizeMedicationRequest(medicationRequest);
  const generate = useGeneratePriorAuth();
  const submit = useSubmitPriorAuth();
  const {
    mutate: generateMutate,
    reset: generateReset,
    isIdle: generateIdle,
    isPending: generatePending,
    isSuccess: generateSuccess,
    isError: generateIsError,
    data: generateData,
    error: generateError,
  } = generate;
  const {
    mutate: submitMutate,
    reset: submitReset,
    isPending: submitPending,
    isSuccess: submitSuccess,
    isError: submitIsError,
    data: submitData,
    error: submitError,
  } = submit;

  const [narrative, setNarrative] = useState('');
  const narrativeInitRef = useRef(false);

  // Fire the generate mutation once when the modal opens.
  useEffect(() => {
    if (!open) return;
    if (!generateIdle) return;
    if (!medicationRequest.id) return;
    generateMutate({ patientId, medicationRequestId: medicationRequest.id });
  }, [open, generateIdle, patientId, medicationRequest.id, generateMutate]);

  // Pre-fill editable narrative once the response arrives.
  useEffect(() => {
    if (generateSuccess && generateData && !narrativeInitRef.current) {
      setNarrative(generateData.justification.narrative);
      narrativeInitRef.current = true;
    }
  }, [generateSuccess, generateData]);

  const handleClose = () => {
    generateReset();
    submitReset();
    setNarrative('');
    narrativeInitRef.current = false;
    onClose();
  };

  const handleSubmit = () => {
    if (!generateData || !medicationRequest.id) return;
    if (narrative.trim().length === 0) return;
    submitMutate({
      patientId,
      medicationRequestId: medicationRequest.id,
      narrative,
      justification: { ...generateData.justification, narrative },
    });
  };

  const canSubmit = generateSuccess && !submitPending && !submitSuccess && narrative.trim().length > 0;

  // After a successful submission, render a single confirmation panel in place
  // of the form so the doctor cannot accidentally double-submit.
  if (submitSuccess && submitData) {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title={`Prior Authorization — ${summary.title}`}
        size="xl"
      >
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden={true} />
          <p className="text-base font-semibold text-slate-900">Prior authorization submitted</p>
          <p className="text-sm text-slate-600">
            Audit record written to the FHIR server.
          </p>
          <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
            {submitData.reference}
          </code>
          <p className="text-[11px] text-slate-500">
            Created {new Date(submitData.created).toLocaleString()}
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Prior Authorization — ${summary.title}`}
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-indigo-600" aria-hidden={true} />
          <div>
            <span className="font-medium">AI-generated draft.</span> Review every claim, edit the
            cover-letter narrative, and verify citations before submitting.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 sm:grid-cols-2">
          <div>
            <span className="text-slate-500">Patient · </span>
            {generateData?.evidence.patientName ?? <span className="text-slate-400">loading…</span>}
          </div>
          <div>
            <span className="text-slate-500">Medication · </span>
            {summary.title}
            {summary.meta ? <span className="text-slate-500"> ({summary.meta})</span> : null}
          </div>
        </div>

        {generatePending && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            Gathering evidence and drafting justification… this typically takes 5–15 seconds.
          </div>
        )}

        {generateIsError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" aria-hidden={true} />
            <div>
              <p className="font-medium">Could not generate justification.</p>
              <p className="mt-0.5 text-xs text-red-800">
                {generateError instanceof Error ? generateError.message : 'Unknown error'}
              </p>
            </div>
          </div>
        )}

        {generateSuccess && generateData && (
          <>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <RationaleBlock
                label="Diagnosis rationale"
                body={generateData.justification.diagnosisRationale}
              />
              <RationaleBlock
                label="Supporting evidence"
                body={generateData.justification.supportingEvidence}
              />
              <RationaleBlock
                label="Prior therapy rationale"
                body={generateData.justification.priorTherapyRationale}
              />
            </div>

            {generateData.justification.missingEvidence.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden={true} />
                  Missing evidence ({generateData.justification.missingEvidence.length})
                </div>
                <ul className="mt-1 list-disc pl-5 text-amber-800">
                  {generateData.justification.missingEvidence.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
                <p className="mt-1.5 text-amber-800">
                  Resolve these before submitting, or document why the gap is acceptable.
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="narrative"
                className="block text-[11px] font-medium uppercase tracking-wide text-slate-500"
              >
                Cover-letter narrative (editable)
              </label>
              <textarea
                id="narrative"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={6}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Cover-letter narrative addressed to the payer…"
              />
            </div>

            <CitationsList citations={generateData.justification.citations} />

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                {generateData.usage?.totalTokenCount
                  ? `${generateData.usage.totalTokenCount.toLocaleString()} tokens`
                  : ''}
              </span>
              <span>
                {generateData.timings
                  ? `Evidence ${generateData.timings.evidenceMs} ms · LLM ${generateData.timings.llmMs} ms`
                  : ''}
              </span>
            </div>

            {submitIsError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" aria-hidden={true} />
                <div>
                  <p className="font-medium">Submission failed.</p>
                  <p className="mt-0.5 text-xs text-red-800">
                    {submitError instanceof Error ? submitError.message : 'Unknown error'}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            title={
              narrative.trim().length === 0
                ? 'Narrative cannot be empty'
                : !generateSuccess
                  ? 'Wait for the draft to finish'
                  : 'Write a Communication audit record to the FHIR server'
            }
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitPending ? 'Submitting…' : 'Approve & Submit'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
