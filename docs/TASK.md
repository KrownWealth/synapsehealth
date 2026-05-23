# TASK.md — Prior Authorization Accelerator

> Build breakdown for the spec in [SPEC.md](./SPEC.md).
> Phases are sequenced so each one is independently shippable and gives you something to demo at the end. Each phase lists the SPEC sections it covers, the concrete files that change, and acceptance criteria that prove it's done.

---

## Phase 0 — Foundations (✓ already done)

What's already in the repo:

- **Patient list + detail UI** — sticky demographics + 9 collapsible medical-history sections, each entry expandable to raw FHIR JSON (SPEC §4.2)
- **BFF** (`/api/fhir/[...path]`) — resource allowlist covers `Patient`, `Observation`, `Condition`, `MedicationRequest`, `AllergyIntolerance`, `Immunization`, `Encounter`, `Procedure`, `DiagnosticReport`, `DocumentReference`, `Claim`, plus `Organization`/`Practitioner`/`Location`
- **10 Synthea patients on the Medblocks tenant** — the demo cohort. The cleanup utility (`Prior Auth/wipe.ts`) keeps this honest if extra data gets uploaded.
- **Server-side prefetch + TanStack Query hydration** on every page so first paint shows real data, not skeletons
- **Architecture in place** for SPEC §7 (BFF, parallel `Promise.all`, 60s cache, server prefetch, no secrets in the browser bundle)

---

## Phase 1 — Admin Dashboard with PA Worklist (✓ already done)

**SPEC sections:** §1 (the inbox-first framing) · §2.1 (urgency model) · §4.1 (dashboard page structure) · §7.1 (cross-patient FHIR queries)

**Goal:** the home page (`/`) becomes a cross-patient PA worklist. The doctor opens the app and immediately sees every active prescription across their panel that hasn't been PA-submitted yet, with KPI tiles for outstanding / overdue / submitted / patient counts. The patient list lives as a sub-section below the worklist, still searchable + paginated.

**Files (created)**
- `lib/fhirServer.ts` — `getActiveMedicationsAcrossPatients(ids)` + `getAllCommunicationsForPatients(ids)`
- `lib/fhirClient.ts` — `fetchActiveMedicationsAcrossPatients(ids)` + `fetchAllCommunicationsForPatients(ids)`
- `lib/dashboardUtils.ts` — `buildWorklist()`, `computeKpis()`, urgency tiering, day-ago formatting
- `hooks/useDashboard.ts` — orchestrates the patient → meds + comms parallel fetch via TanStack Query
- `components/dashboard/KpiTiles.tsx` — 4 status tiles
- `components/dashboard/PaWorklist.tsx` — the worklist + collapsible submitted section
- `components/dashboard/DashboardHome.tsx` — composes it all, embeds the existing patient list as a panel below
- `app/page.tsx` — replaced the bare patient list with the dashboard, two-stage server prefetch

**Acceptance criteria**
- [x] Home page (`/`) renders a Prior Authorization Dashboard header with KPI tiles + worklist + patient panel
- [x] KPI tiles populate from real FHIR data (verified: numbers reflect actual active-meds count from the cohort)
- [x] Worklist rows show patient name + medication name + days-ago + urgency marker (red / amber / slate)
- [x] Each row is a link to the patient's detail page
- [x] "Show submitted" toggle reveals a collapsible green-tagged section for already-submitted items
- [x] "Inbox zero" empty state when no rows need review
- [x] Patient panel below still works (search, pagination)
- [x] Server-prefetched: initial HTML contains worklist rows + patient cards (verified: 34 patient-link refs in SSR'd HTML, drug names like Pulmicort/Simvastatin/metoprolol visible)
- [x] Cross-patient queries use comma-OR list syntax (`?patient=Patient/A,Patient/B,…&_count=200`) — single bundle, no N+1
- [x] Production build clean: `npx tsc --noEmit` and `npx next build` both pass

**Done.** Dashboard bundle at `/` is 6.11 kB First Load JS, loads in ~600ms with full SSR'd data.

---

## Phase 2 — "Generate PA Packet" trigger on active medications (✓ already done)

**SPEC sections:** §4.2 (patient detail page) · §5.1 (modal entry point)

**Goal:** on the patient detail page, every active `MedicationRequest` row in the Medications section gets a **[Generate PA]** button. Click → placeholder modal opens (real LLM hookup arrives in Phase 4). This is the bridge between the worklist (Phase 1) and the packet assembly (Phase 3+).

**Files (created)**
- `components/ui/Modal.tsx` — reusable modal primitive (Escape, backdrop click, body scroll lock, `role="dialog"`, focus on open). Phase 5 originally owned this; brought forward so the Phase 2 placeholder isn't a throwaway stub.
- `components/priorAuth/GeneratePaButton.tsx` — the action button + placeholder modal contents. Returns `null` for any MedicationRequest whose `status !== 'active'`.

**Files (modified)**
- `components/history/ResourceEntry.tsx` — accept an optional `action: ReactNode` slot. Outer row converted from `<button>` to `<div role="button">` so the inner action button isn't nested in another button (invalid HTML). Keyboard activation (Enter/Space) preserved. The action button uses `e.stopPropagation()` so clicking it doesn't toggle the row expansion.
- `components/history/ResourceSection.tsx` — accept `renderAction?: (resource) => ReactNode`, pipe through to each entry.
- `components/patients/PatientDetailClient.tsx` — pass `renderAction` only to the Medications section.

**Acceptance criteria**
- [x] Active MedicationRequest rows on the detail page show a `[Generate PA]` button (verified: patient with 3 active meds returns 3 button-eligible rows)
- [x] Completed/stopped/draft MedicationRequest rows do NOT show the button (component returns `null` early)
- [x] Clicking the button opens a placeholder modal (medication summary + Phase 3/4 placeholder notice + Close) — no LLM yet
- [x] Modal dismisses via close X, backdrop click, and Escape key
- [x] Modal locks body scroll while open and restores on close
- [x] Clicking the row still expands the raw JSON; clicking the button only opens the modal (no event bubble)
- [x] Patient detail page bundle size growth: 5.84 kB → 7.10 kB (+1.26 kB, under the 2 kB target)
- [x] `npx tsc --noEmit` and `npx next build` both clean

**Done.**

---

## Phase 3 — Evidence Aggregator (✓ already done)

**SPEC sections:** §2.2 (parallel evidence gathering) · §7.1 (Promise.all in the builder)

**Goal:** server-side function `gatherEvidence(patientId, medicationRequestId)` that runs the FHIR queries in parallel and returns a structured `EvidenceBundle` — the MedicationRequest itself, the patient's active diagnoses, recent labs, prior medications, clinical notes, and Coverage.

**What this proves:** the deterministic data-assembly layer. The LLM never queries FHIR. The aggregator runs first; the LLM only sees what it returns.

**Files (created)**
- `types/priorAuth.ts` — `EvidenceBundle`, `Citation`, `Justification` + nested resource shapes (`MedicationEvidence`, `ConditionEvidence`, `LabEvidence`, `PriorMedicationEvidence`, `NoteEvidence`, `CoverageEvidence`). The bundle also carries a `timings` object so parallelism can be verified at runtime.
- `lib/priorAuth/evidence.ts` — `gatherEvidence()`. Single `Promise.all` over 7 sub-fetches (Patient + MedicationRequest + Conditions + Observations/labs + prior MedicationRequests + DocumentReferences + Coverage). Each sub-fetch is wrapped in a `timed()` helper that captures duration and isolates errors (a missing resource type on the tenant becomes a gap, not a failure). `import 'server-only'` at the top.
- `app/api/prior-auth/evidence/route.ts` — GET endpoint at `/api/prior-auth/evidence?patientId=…&medicationRequestId=…`. Thin wrapper around `gatherEvidence()`. Useful for debugging through Phase 7; Phase 4's `/api/prior-auth/generate` will call the same library function.

**Acceptance criteria**
- [x] Calling `gatherEvidence()` for a real seeded patient returns a populated bundle. Verified against Jody Monahan + active Simvastatin: 11 active conditions (with SNOMED codes), 20 recent labs (with LOINC codes + values), 3 prior medications, 10 DocumentReferences.
- [x] All FHIR fetches happen in a single parallel batch — verified via `timings.durations`: each sub-fetch took 833–844 ms individually, `totalMs` came in at 848 ms. Sequential execution would have been ~5800 ms.
- [x] `gaps[]` is populated when evidence is missing. Verified: Coverage was wiped on the tenant earlier; bundle returns `coverage: null` and `gaps: ["No insurance coverage on record"]`.
- [x] `lib/priorAuth/evidence.ts` carries `import 'server-only'` and never reaches the browser bundle. Verified: `npx next build` clean and patient detail / dashboard bundle sizes unchanged after adding the aggregator.
- [x] `npx tsc --noEmit` and `npx next build` both clean

**Done.**

---

## Phase 4 — LLM Justification Endpoint (Gemini) (✓ already done)

**SPEC sections:** §2.2 (LLM as writer, not researcher) · §8 (env vars)

**Goal:** Route Handler at `/api/prior-auth/generate` that takes `{patientId, medicationRequestId}`, runs the evidence aggregator, calls Gemini with a strict response schema, validates the response with Zod, returns `{justification, evidence, usage, timings}`.

**Files (created)**
- `app/api/prior-auth/generate/route.ts` — POST handler. Wraps `gatherEvidence()` then Gemini call with `responseMimeType: 'application/json'` + OpenAPI-flavored `responseSchema`. Validates with Zod. Enforces citation grounding by checking every `citations[].resourceId` against the set of ids in the evidence bundle — returns 502 if the model hallucinates an id.
- `lib/priorAuth/schema.ts` — `JustificationSchema` (Zod) mirroring the `Justification` interface.
- `package.json` — added `@google/genai@2.6.0` + `zod@4.4.3`.
- `.env.example` — added `GEMINI_API_KEY` + optional `GEMINI_MODEL` (defaults to `gemini-2.5-flash` for free-tier compatibility; set to `gemini-2.5-pro` once billing is enabled).

**Error mapping**
- **503** — `GEMINI_API_KEY` not configured, or auth error from Gemini (401/403/api-key/unauthorized/forbidden)
- **429** — quota or rate limit ("rate", "429", "quota" in error message)
- **502** — non-JSON output, Zod validation failure, citation hallucination, or any other LLM error
- **500** — evidence aggregator failure unrelated to FHIR
- **400** — malformed request body
- **2xx and 4xx FHIR errors** are forwarded with their `OperationOutcome` payload

**Acceptance criteria**
- [x] Without `GEMINI_API_KEY` set, endpoint returns 503 with `{ error: 'GEMINI_API_KEY is not configured on the server' }` (verified by code path inspection)
- [x] With key set, endpoint produces a valid `Justification` JSON for a real seeded patient. Verified against Jody Monahan + Simvastatin: ~14s end-to-end (13s LLM + 876ms evidence) on `gemini-2.5-flash`; well under the 30s `maxDuration`. Switching to `gemini-2.5-pro` should bring quality up; current latency is the free-tier flash floor.
- [x] Every `citations[].resourceId` matches an id in the evidence bundle. Verified: all 7 citations resolved (3 SNOMED-coded conditions, 1 LOINC lab, 2 prior meds, 1 BMI condition).
- [x] When evidence is missing, `missingEvidence[]` is populated. Verified: the model correctly flagged "No recent lipid panel on record (LDL, HDL, Total Cholesterol, Triglycerides)" — a real clinical gap for a Simvastatin PA.
- [x] Gemini API key never appears in any `.next/static/chunks/*` bundle. Verified: `grep -rE "GEMINI_API_KEY|@google/genai|AIza[0-9A-Za-z_-]{30}"` returns no matches in client chunks.
- [x] Error mapping: 429 (quota) verified live (the user's free-tier key has zero quota for `gemini-2.5-pro` — the route correctly returned 429 with the quota detail).
- [x] `npx tsc --noEmit` and `npx next build` both clean.

**Notes for future sessions**
- The model lives at `process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'`. Set `GEMINI_MODEL=gemini-2.5-pro` in `.env.local` for production-grade narrative quality.
- LLM latency on `gemini-2.5-flash` runs 10–14s for ~6k input tokens. Phase 5's modal needs a clear loading state.
- The route returns `timings: { llmMs, evidenceMs }` so the UI can surface "where the time went" for debugging.

**Done.**

---

## Phase 5 — Justification Builder Modal (real, with LLM) (✓ already done)

**SPEC sections:** §5.1 (modal layout) · §6.1 (design principles) · §6.4 (accessibility)

**Goal:** replace the Phase 2 placeholder modal with the real one. Loading state, evidence summary table, AI-drafted editable narrative, citations disclosure, gap banner, non-dismissible AI-generated-draft banner.

**Files (created)**
- `hooks/usePriorAuth.ts` — `useGeneratePriorAuth()` TanStack Query mutation against `/api/prior-auth/generate`. Returns typed `GenerateResponse` with `justification`, `evidence`, `usage`, `timings`.
- `components/priorAuth/JustificationModal.tsx` — composes everything inside the Phase 2 `Modal` primitive: AI-generated-draft banner (non-dismissible), patient/medication header, loading skeleton with explanatory wait message, error block with retryable message, three rationale paragraphs in their own card, gap banner (only when `missingEvidence` non-empty), editable narrative textarea pre-filled on success via a ref-guarded effect, collapsible citations disclosure, footer with `Cancel` + `Approve & Submit` (latter disabled until narrative has content; submission lands in Phase 6). Token usage + evidence/LLM timings rendered as a small dev footer.

**Files (modified)**
- `components/priorAuth/GeneratePaButton.tsx` — replaced the inline placeholder modal body with `<JustificationModal>`. Now takes `patientId` as a prop.
- `components/patients/PatientDetailClient.tsx` — `renderMedicationAction` threads `patientId` (already on the page) into the button.

**Mutation lifecycle in the modal**
- Modal opens → if mutation is idle, fire `mutate({ patientId, medicationRequestId })`. Effect re-fires only when `open` flips to true or `medicationRequest.id` changes — `mutate` is stable in TanStack Query v5.
- Response arrives → `useEffect` (guarded by a `useRef` so user edits aren't overwritten) seeds the editable narrative textarea from `justification.narrative`.
- Modal closes → `handleClose` calls `reset()`, clears narrative, resets the ref, then `onClose()`. Next open starts fresh.

**Acceptance criteria**
- [x] Click `[Generate PA]` → mounts `JustificationModal` with `open=true` → effect fires `mutate` → loading state renders (`Loader2` spinner + "5–15 seconds" hint). Verified by code path; underlying endpoint already verified end-to-end in Phase 4 (14s response with rich justification).
- [x] Narrative is editable — `<textarea value={narrative} onChange={...}>` pre-filled via `narrativeInitRef` so user edits persist.
- [x] Citations disclosure renders all `{resourceType}/{resourceId}` from the LLM response with their detail strings — `<CitationsList>` collapsible block with `code` + detail per row.
- [x] Gap banner appears when `missingEvidence[]` is non-empty — amber banner with `AlertTriangle` icon + bulleted gaps + "resolve before submitting" footer.
- [x] AI-generated-draft banner is non-dismissible — rendered unconditionally at the top of the modal body, no close affordance.
- [x] Modal closes via backdrop click, Escape, and Cancel — all three. The Phase 2 `Modal` primitive handles backdrop + Escape; the Cancel button calls `handleClose`. Cleanup is uniform across all three paths.
- [x] Approve & Submit button disabled until narrative has non-empty content — `disabled={!isSuccess || narrative.trim().length === 0}`.
- [x] `npx tsc --noEmit` clean · `npx next build` clean
- [x] Patient detail bundle: 7.10 kB → 8.58 kB (+1.48 kB for the mutation hook + modal)

**Browser flow not exercised headlessly** — the modal mounts only when the user expands the Medications section and clicks the button. Verify in browser: visit `/patients/35b353dd-402b-571a-d67a-af0a104d0854`, expand Medications, click `[Generate PA]` on the active Simvastatin row, wait ~14s.

**Done.**

---

## Phase 6 — Submission + Audit + Worklist Refresh (✓ already done — v3.1, Da Vinci PAS)

**SPEC sections:** §2.3 (Da Vinci PAS `Claim` shape) · §5.2 (submission flow)

**Goal:** clicking **Approve & Submit** writes a Da Vinci PAS `Claim` (`use=preauthorization`) to FHIR, surfaces a confirmation with the new resource id, and invalidates the dashboard queries so the worklist row moves from "Needs review" to "Submitted" without a page reload.

> **v3.1 refactor (this phase was first built with `Communication`).** Switched the submission shape from `Communication` to a Da Vinci PAS-aligned `Claim` so the resource we write matches the structure a real payer endpoint expects. The Communication-based round-trip worked end-to-end first, then was swapped for the standards-aligned shape in a single follow-up pass.

**Files (created)**
- `lib/priorAuth/coverage.ts` — `ensureCoverage(patientId)` (server-only). Returns the id of an active Coverage if one exists; otherwise POSTs a minimal self-pay Coverage (`status: active`, `type.coding[0].code: pay` from HL7 v3-ActCode, `beneficiary: Patient/{id}`, `payor: [{ display: 'Self-pay' }]`) and returns its id. Honors PAS Claim's required `insurance.coverage` cardinality for patients with no documented insurance, without fabricating insurer data.
- `app/api/prior-auth/submit/route.ts` — POST handler. Validates body with Zod (`SubmitInputSchema`: `{ patientId, medicationRequestId, narrative, justification }`). Fetches the MedicationRequest to lift `requester` (for Claim.provider) and `medicationCodeableConcept` (for item.productOrService). Calls `ensureCoverage(patientId)`. Builds the Claim — `status: active`, `use: preauthorization`, `type: pharmacy`, `patient`, `created`, `provider`, `priority: normal`, `insurance`, `prescription`, `item[0].productOrService` (RxNorm lifted from the MR), `supportingInfo` (sequence 1 = narrative as `valueString` with `category: clinical`; subsequent entries = each citation as `valueReference` with `category: info`). POSTs to `/Claim`, returns `{ claimId, reference, created, coverageId }`. Fails 422 if `MedicationRequest.requester` is missing (PAS requires provider).

**Files (modified)**
- `lib/fhirServer.ts` — replaced `getAllCommunicationsForPatients` with `getAllPreAuthClaimsForPatients` (`/Claim?use=preauthorization&patient={comma-OR-list}&_count=200`).
- `lib/fhirClient.ts` — same swap on the client mirror.
- `lib/dashboardUtils.ts` — `buildWorklist` now scans `Claim.prescription.reference` (filtering by `use === 'preauthorization'`) instead of `Communication.about[]`. `WorklistItem.submittedClaimId` replaces `submittedCommunicationId`.
- `hooks/useDashboard.ts` — query key `['communications-for', …]` → `['preauth-claims-for', …]`. Returns `preAuthClaims` instead of `communications`.
- `app/page.tsx` — server prefetch uses the new key + the new server fetcher.
- `components/dashboard/DashboardHome.tsx` — consumes `preAuthClaims` from the hook.
- `components/dashboard/PaWorklist.tsx` — submitted row chip now reads `Claim/{id}` instead of `Communication/{id}`.
- `hooks/usePriorAuth.ts` — `SubmitResponse` typed as `{ claimId, reference, created, coverageId }`. Invalidation predicate matches `['preauth-claims-for', …]`.
- `components/priorAuth/JustificationModal.tsx` — success-state confirmation panel shows `Claim/{id}` and "Created {timestamp}".
- `app/api/fhir/[...path]/route.ts` — added `Communication` to `ALLOWED_RESOURCES` (left in place as a generally allowed resource even though it's no longer the PA submission shape).

**Acceptance criteria (v3.1, Da Vinci PAS)**
- [x] Claim is **standards-aligned**. Verified by retrieving the created Claim: status=active, use=preauthorization, type=pharmacy (HL7 claim-type system), patient, created, provider (real Practitioner lifted from MedicationRequest.requester — "Dr. Georgianne Howe"), priority=normal (HL7 processpriority), insurance[0] focal=true pointing at Coverage, prescription pointing at MedicationRequest, item[0].productOrService with RxNorm 312961 + display + text, supportingInfo with 3 entries (narrative as clinical valueString + 2 citation valueReferences).
- [x] **Coverage auto-created** when missing. Verified: patient had 0 Coverage resources before submission; after submit, `Coverage/a6956e65-…c9a6c06891ce` was created with `status: active, type: pay, beneficiary: Patient/{id}, payor: [{display: 'Self-pay'}]`.
- [x] **Query filtering correct**. Verified: `Claim?patient={id}` returned 38 entries (37 Synthea billing + 1 PA); `Claim?use=preauthorization&patient={id}` returned exactly 1 (the PA). The use filter is doing its job.
- [x] **Round-trip latency** acceptable. POST /api/prior-auth/submit → 200 in 3.97s (includes ensureCoverage + MedicationRequest fetch + Coverage POST + Claim POST).
- [x] **Dashboard worklist refreshes**. Verified live: home page KPI flipped from Submitted: 0 → **Submitted: 1**; worklist row now displays `Claim/120a6f11` chip.
- [x] `npx tsc --noEmit` clean · `npx next build` clean
- [x] Patient detail bundle: 8.97 kB (essentially unchanged from the Communication version)
- [x] New `/api/prior-auth/submit` route registered as dynamic

**Caveat** — modal visual states (success panel, disabled-Cancel-during-pending) and worklist invalidation behavior are verified by code path, not by clicking the button in a browser. API round-trip and resulting FHIR state are verified end-to-end via curl.

**Done.**

---

## Phase 7 — Polish & Demo Prep

**Goal:** the rough edges that make a demo land vs. limp.

**Items, in priority order**
- [ ] **Loading skeletons** that match real card shapes for KPI tiles and worklist rows
- [ ] **Toast/confirmation animation** on Approve & Submit so the green confirmation isn't easy to miss
- [ ] **Per-section error states** with retry — if the PA-Claims query fails, the worklist still renders without submission badges
- [ ] **"Regenerate" affordance** in the modal if the doctor wants Gemini to take another pass
- [ ] **Cost telemetry** — surface Gemini `usage` somewhere accessible (footer of modal, dev only)
- [ ] **README rewrite** — live URL, env vars, BFF architecture paragraph, FHIR server in use, how to run locally
- [ ] **`docs/AGENT.md` audit** — still references the sepsis pivot; rewrite against the PA codebase or delete
- [ ] **Deploy to Vercel** — set `FHIR_BASE_URL`, `FHIR_SERVER_TOKEN`, `GEMINI_API_KEY` as production env vars; verify the BFF doesn't break on the platform's edge runtime

**Estimated effort:** 2 hours

---

## Total effort estimate

| Phase | Hours | Status |
|---|---|---|
| 0 — Foundations | — | ✓ done |
| 1 — Admin Dashboard + Worklist | 2 | ✓ done |
| 2 — Generate PA button + placeholder modal + Modal primitive | 1.5 | ✓ done |
| 3 — Evidence Aggregator | 2 | ✓ done |
| 4 — LLM Endpoint (Gemini) | 3 | ✓ done |
| 5 — Justification Modal (real) | 2.5 | ✓ done |
| 6 — Submission + Audit + worklist refresh | 1.5 | ✓ done |
| 7 — Polish + deploy | 2 | pending |
| **Required total (7)** | **2 hours** |  |

Roughly **1/4 of an engineer-day** of remaining work — Phase 7 polish + deploy is all that's left.

---

## Build order — what to do first thing each session

1. **Next session:** Phase 7 (polish + Vercel deploy)

If at any session you hit a blocker (e.g., a FHIR query not behaving against Medblocks), stop and ask. Don't invent a workaround silently.
