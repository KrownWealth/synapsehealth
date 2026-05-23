# SPEC.md — Prior Authorization Accelerator

> **Version:** 3.1
> **Challenge:** Practitioner-Facing FHIR App
> **Timeline:** 2 weeks
> **Judging Criteria Addressed:** Basic requirements · FHIR performance · Deployment · Visual design · Business use-case

**v3.1 changes:** submission shape moved to the Da Vinci PAS standard (`Claim` with `use: "preauthorization"`) — was `Communication` in v3.0. Auto-creates a self-pay `Coverage` (`type: pay`) on first submission when none exists. ClaimResponse is out of scope (no payer simulation).

---

## 1. Business Case

### The Problem

Prior authorization is the **#1 administrative burden in US healthcare**. The American Medical Association puts the total cost at **$13B per year** in physician practice time alone, and CAQH's annual industry index puts the broader administrative burden in the tens of billions on top of that. Independent of cost, **prior auth delays care by days or weeks**: AMA's 2024 survey found 94% of physicians report care delays caused by PA, and 24% report that PA has led to a serious adverse event for a patient in their care.

The mechanics are mundane and brutal. A doctor orders a high-cost drug, an advanced imaging study, or a specialist procedure. The payer requires pre-approval before they'll pay. To get that approval the doctor — or, more commonly, a clinical staff member — has to assemble a packet:

- The qualifying diagnosis with its ICD-10 code
- Coverage details and member ID
- Supporting lab results, prior failed treatments, and clinical notes
- A written narrative tying the evidence to the payer's medical-necessity criteria
- A payer-specific form filled out by hand

The information is already in the chart as structured FHIR data. The form is mechanical. The narrative writes itself from the data. But the workflow spans 4–6 screens in the EHR, takes **~45 minutes per request** in steady state, and there are tens of thousands of these every day across a large practice.

### Why now

The CMS **Interoperability and Prior Authorization rule** (CMS-0057-F, effective in stages through 2026–2027) requires payers to expose PA decisions and statuses via FHIR APIs and to respond within 72 hours for urgent / 7 days for standard requests. Even before those APIs are fully online, every modern EHR already exposes the source-side clinical data via FHIR R4. The bottleneck has always been the manual assembly step, not the data.

### The Solution

**Prior Authorization Accelerator** is a practitioner-facing app organized as a **cross-patient admin dashboard**. The doctor opens the app and sees, at a glance:

1. A **worklist** of every active prescription across their panel that hasn't been PA-submitted yet, sorted by urgency
2. KPI tiles showing how many are outstanding, how many are overdue, how many have been submitted, and how many patients are on the panel
3. The patient list, still accessible as a sub-section of the dashboard

Clicking any worklist row navigates into the patient's chart, where the doctor can:

4. Click **Generate PA packet** on the relevant prescription
5. Review an auto-assembled, citation-grounded justification packet (diagnosis, supporting labs, prior therapy, AI narrative)
6. Edit if needed; click Approve & Submit
7. The submission writes a `Claim` (`use: "preauthorization"`, Da Vinci PAS shape) to FHIR, which immediately moves the worklist row to "submitted"

**Target outcome:** the 45-minute manual task collapses to a **2-minute review**. The doctor never has to click through patients one by one to find what needs PA — the dashboard surfaces the worklist directly.

### What the app does NOT do

- It does **not** decide which prescriptions need PA. That is a payer-specific judgment (the payer's CRD endpoint in production). In this demo, every active prescription is a worklist candidate; the doctor decides what actually requires submission. No hardcoded drug catalog.
- It does **not** submit to a real payer endpoint or receive a `ClaimResponse`. The `Claim` is written to the same FHIR server as the audit-of-record; in production it would POST to the payer's PAS endpoint and the worklist would also display the payer's `ClaimResponse.outcome`.

### Why this wins the business-case criterion

- PA is real, quantified, and the #1 admin burden named by every major US clinical professional body (AMA, MGMA, AAFP, ACP)
- The CMS interoperability rule provides regulatory tailwind: every payer must move this direction by 2027
- The solution uses only FHIR R4 resources already exposed by every certified EHR
- The cross-patient dashboard is the workflow shape practices actually use — a PA inbox, not a per-patient hunt

---

## 2. Domain Concepts

### 2.1 What the dashboard considers "needing review"

Every `MedicationRequest` with `status=active` belonging to a patient on the panel, **for which no Da Vinci PAS `Claim` (`use=preauthorization`) yet exists**. The set is computed dynamically from FHIR data — no static catalog.

Urgency is derived from `MedicationRequest.authoredOn`:

| Tier | Criterion | Visual |
|---|---|---|
| Overdue | ≥ 7 days since `authoredOn`, no PA Claim | Red ⚠ |
| This week | 2–6 days, no PA Claim | Amber ⦿ |
| Fresh | 0–1 days, no PA Claim | Slate · |
| Submitted | A `Claim` (`use=preauthorization`) references the MedicationRequest via `prescription` | Green ✓ (collapsed by default) |

### 2.2 The justification packet

When the doctor clicks **Generate PA packet** on an active prescription, the app:

1. Runs the **evidence aggregator** — server-side, in parallel via `Promise.all`:
   - `Condition` (active diagnoses, ICD-10 codes — likely indication for the drug)
   - `Observation` (recent labs)
   - Past `MedicationRequest` with status `stopped`/`completed` (prior failed therapy)
   - Recent `DocumentReference` (consult notes for narrative grounding)
   - `Coverage` (payer name — "who do we submit to?")
2. Hands the structured evidence bundle to an LLM (Gemini) with a strict output schema:
   - `diagnosisRationale`, `supportingEvidence`, `priorTherapyRationale`, `narrative`, `citations[]`, `missingEvidence[]`
   - Every claim in `narrative` must reference an entry in `citations[]` pointing to a real FHIR `resourceType/id`
3. Validates the LLM response against a Zod schema before showing it to the doctor
4. Renders the packet for review

**The LLM never queries FHIR.** The aggregator runs first in deterministic code; the LLM is a writer that only sees the evidence the aggregator hands it. This is the primary hallucination control.

### 2.3 Submission — Da Vinci PAS `Claim`

On Approve & Submit, the app constructs a `Claim` resource per the **Da Vinci Prior Authorization Support** (PAS) implementation guide and POSTs it to FHIR. This is the same resource shape a real payer endpoint would accept; the only thing we omit is the payer's response (`ClaimResponse`), which is out of scope for this demo.

```ts
{
  resourceType: 'Claim',
  status: 'active',
  use: 'preauthorization',
  type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type',
                     code: 'pharmacy' }] },
  patient: { reference: 'Patient/{id}' },
  created: <ISO timestamp>,
  provider: <MedicationRequest.requester>,        // real Practitioner reference
  priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority',
                         code: 'normal' }] },
  insurance: [{ sequence: 1, focal: true,
                coverage: { reference: 'Coverage/{id}' } }],
  prescription: { reference: 'MedicationRequest/{id}' },
  item: [{
    sequence: 1,
    productOrService: { coding: [<RxNorm coding lifted from medicationCodeableConcept>] },
  }],
  supportingInfo: [
    { sequence: 1,
      category: { coding: [{ system: '…/claiminformationcategory', code: 'clinical' }] },
      valueString: <edited narrative> },
    // each grounded citation:
    { sequence: 2,
      category: { coding: [{ system: '…/claiminformationcategory', code: 'info' }] },
      valueReference: { reference: 'Condition/{id}', display: <citation detail> } },
    // …
  ],
}
```

The `Claim` is both the **audit record** and the **workflow state**: the dashboard cross-references `Claim.prescription` to mark the corresponding MedicationRequest as "submitted," removing it from the active worklist.

**Coverage handling.** Da Vinci PAS requires `Claim.insurance` to reference an active `Coverage`. The Synthea demo cohort has no Coverage on file. The submit route uses an `ensureCoverage(patientId)` helper that returns an existing active Coverage if present; if none exists it creates a minimal `Coverage` (`status: active`, `type: pay` — the HL7 v3-ActCode for self-pay, `beneficiary` pointing at the Patient, `payor: [{ display: 'Self-pay' }]`) and references that. This honors the standard's cardinality without fabricating insurer data we don't have.

---

## 3. FHIR Resource Mapping

All data is sourced from FHIR R4. No external APIs are required for core functionality.

### 3.1 Patient

| UI Field | FHIR Path |
|---|---|
| Full name | `name[0].given + name[0].family` |
| Gender | `gender` |
| Date of birth | `birthDate` |
| Age (computed) | Derived from `birthDate` |
| Identifiers | `identifier[]` (MRN, member ID, etc.) |
| Address | `address[0]` |
| Contact | `telecom[]` |
| Marital status | `maritalStatus` |
| Languages | `communication[]` |

### 3.2 MedicationRequest

`GET /MedicationRequest?status=active&patient={comma-separated-OR-list}&_count=200`

| UI Field | FHIR Path |
|---|---|
| Medication name | `medicationCodeableConcept.text` or `coding[0].display` |
| RxNorm code | `medicationCodeableConcept.coding[?system contains 'rxnorm'].code` |
| Dosage | `dosageInstruction[0].text` |
| Authored date | `authoredOn` |
| Status | `status` |
| Subject | `subject.reference` (links to Patient on the worklist) |

The dashboard issues a single comma-OR query across all panel patient IDs to get all their active meds in one bundle.

### 3.3 Claim (`use=preauthorization`)

`GET /Claim?use=preauthorization&patient={comma-separated-OR-list}&_count=200`

The Da Vinci PAS submission record. Used to identify which MedicationRequests have already been PA-submitted. The dashboard parses `Claim.prescription.reference` client-side and matches against the worklist's MedicationRequest IDs.

| UI use | FHIR path |
|---|---|
| MedicationRequest being authorized | `Claim.prescription.reference` |
| Submission timestamp | `Claim.created` |
| Drug being authorized | `Claim.item[0].productOrService.coding[?system contains 'rxnorm'].code` |
| Provider of record | `Claim.provider.reference` (lifted from MedicationRequest.requester) |
| Payer of record | `Claim.insurance[0].coverage.reference` → `Coverage.payor[0].display` |
| Narrative for audit | `Claim.supportingInfo[?category code='clinical'].valueString` |
| Grounded citations | `Claim.supportingInfo[?category code='info'].valueReference` |

The `use=preauthorization` filter is essential — Synthea seeds a large number of billing `Claim`s (mean ~38/patient on the demo cohort) that have nothing to do with PA. The use parameter narrows the panel-wide query to just the PAS submissions.

### 3.4 Condition

`GET /Condition?patient=:id`

| UI Field | FHIR Path |
|---|---|
| Condition name | `code.text` or `code.coding[0].display` |
| ICD-10 code | `code.coding[?system contains 'icd-10'].code` |
| Onset date | `onsetDateTime` |
| Clinical status | `clinicalStatus.coding[0].code` |

### 3.5 Observation

`GET /Observation?patient=:id`

| UI Field | FHIR Path |
|---|---|
| Test name | `code.text` or `code.coding[0].display` |
| LOINC code | `code.coding[?system contains 'loinc'].code` |
| Value | `valueQuantity.value` + `valueQuantity.unit`, or `valueString`, or `component[]` |
| Recorded | `effectiveDateTime` |

### 3.6 DocumentReference

`GET /DocumentReference?patient=:id`

| UI Field | FHIR Path |
|---|---|
| Document type | `type.text` |
| Created | `date` |
| Author | `author[0].display` |
| Attachment | `content[0].attachment.url` or `data` |

Used as supporting evidence for the narrative — the doctor's most recent consult note for the relevant condition.

### 3.7 Other patient-history resources

The patient detail page also surfaces `Procedure`, `AllergyIntolerance`, `Immunization`, `Encounter`, `DiagnosticReport`, and `Claim` in collapsible sections — each entry expandable to its raw FHIR JSON. These aren't load-bearing for the PA workflow but provide chart context.

### 3.8 Coverage

`GET /Coverage?patient=:id`

Shown inline in the justification modal as "Payer: {name} · {status}". The Synthea data on the demo tenant carries only `status` and `payor[0].display` (it's lifted from `EOB.contained.Coverage` which is intentionally minimal); a real EHR's Coverage resources would carry the full §3 field set (member ID, group, plan, effective period, primary marker) and the modal would surface them automatically.

---

## 4. Page Structure

### 4.1 Dashboard (`/`)

The home page. Four blocks, top to bottom:

```
┌─ Page header ────────────────────────────────────────────────────┐
│ Prior Authorization Dashboard                                     │
│ Cross-patient view of prescriptions awaiting prior-auth review.  │
└───────────────────────────────────────────────────────────────────┘

┌─ KPI tiles ──────────────────────────────────────────────────────┐
│ [Needs review N]  [Overdue N]  [Submitted N]  [Patients N]       │
└───────────────────────────────────────────────────────────────────┘

┌─ Prior Auth — needs review (N) ──────────────────────────────────┐
│ ⚠  Margaret T. Liu     Oxycontin 10mg ER       14 days ago        │
│ ⦿  Carlos Martinez     Fentanyl 25mcg patch     4 days ago        │
│ ·  John Smith          Lisinopril 10mg          1 day ago         │
│ ...                                                                │
│                                              [ Show submitted ]    │
└───────────────────────────────────────────────────────────────────┘

┌─ Patient panel ──────────────────────────────────────────────────┐
│ [Search bar]                                                       │
│ Patient cards (existing list, searchable + paginated)              │
└───────────────────────────────────────────────────────────────────┘
```

#### Requirements

- [ ] Server-prefetched: first paint includes worklist rows + KPI numbers + patient cards
- [ ] Worklist row → click → navigates to that patient's detail page (Phase 3+ may upgrade this to open the PA modal directly)
- [ ] "Show submitted" toggle reveals the green-tagged submitted rows in a collapsed sub-section
- [ ] Patient panel: search + pagination work independently of the worklist
- [ ] Empty state ("Inbox zero") when no rows need review

#### Performance

- **Two-stage server prefetch.** Stage 1: fetch the panel's patient bundle. Stage 2: in parallel, fetch active meds across all panel patients AND all submission Communications across all panel patients. Both stage-2 queries use FHIR's comma-OR list syntax to scope to the panel.
- **TanStack Query keys are derived from the patient ID list**, so navigating away and back doesn't re-fetch.

### 4.2 Patient Detail (`/patients/:id`)

Unchanged from the foundation work. Sticky demographics header + collapsible medical-history sections (Conditions, Observations, Medications, Procedures, Allergies, Immunizations, Encounters, DiagnosticReports, DocumentReferences, Claims). Each entry expandable to raw FHIR JSON.

Phase 3 will add a **Generate PA packet** action on each active `MedicationRequest` row in the Medications section.

---

## 5. The PA Workflow (clicking through to the modal)

### 5.1 Justification Builder Modal

Clicking **Generate PA packet** on any active MedicationRequest opens a modal:

```
┌─ Prior Auth — Oxycontin 10mg ER ─────────────────────── × ─┐
│ ⓘ AI-generated draft. Requires physician review.             │
│                                                              │
│ Coverage     │ Anthem · active                                │
│ Diagnosis    │ Chronic pain — back (M54.5)                   │
│ Supporting   │ Pain assessment 8/10 (2025-09-12)             │
│ Prior        │ Ibuprofen 800mg — stopped after 6 wks         │
│ therapy      │   for inadequate response                      │
│ Notes        │ Pain mgmt consult 2025-09-15                  │
│                                                              │
│ Narrative (AI-generated, editable):                          │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ This 67-year-old patient has chronic low back pain ...   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Citations (3):                                                │
│   Condition/abc123 — Chronic low back pain                   │
│   Observation/def456 — Pain assessment 8/10                  │
│   MedicationRequest/ghi789 — Prior ibuprofen trial           │
│                                                              │
│ ⚠  Missing evidence:                                          │
│   · None                                                      │
│                                                              │
│        [ Cancel ]  [ Approve & Submit ]                       │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Submission

On Approve & Submit:

1. POST `Claim` (`use=preauthorization`, Da Vinci PAS shape — see §2.3) to FHIR. If the patient has no active `Coverage`, the submit route first POSTs a minimal self-pay Coverage via `ensureCoverage()` so the Claim's required `insurance.coverage` reference resolves.
2. Show confirmation: "Submitted as Claim/{id}"
3. Invalidate the `['preauth-claims-for', ...]` queries so the dashboard refreshes
4. The worklist row moves from "Needs review" to the (collapsed) Submitted section

---

## 6. UI/UX Requirements

### 6.1 Design Principles

- **Workflow density.** PA staff process dozens of these per day. Cards are compact, dense, readable but not padded for consumer audiences.
- **Inbox-first surfacing.** The worklist is the home page. The doctor doesn't hunt for PA candidates patient-by-patient.
- **Gap-first surfacing in the modal.** Missing evidence is the action item; show it prominently before the narrative.
- **Reversibility.** Every AI-generated piece is editable. The Approve & Submit click is the only commitment.
- **Audit visibility.** Every submission produces a FHIR resource the user can navigate to.
- **Color semantics.** Red = denied / missing required evidence / overdue, Amber = warning / gap / this week, Green = approved / criteria met / submitted, Slate = neutral / fresh. Never invert.

### 6.2 Color System

| Token | Hex | Usage |
|---|---|---|
| `--status-approved` | `#3B6D11` bg `#EAF3DE` | Submitted, criteria met |
| `--status-pending` | `#854F0B` bg `#FAEEDA` | This-week worklist, criteria gap |
| `--status-denied` | `#A32D2D` bg `#FCEBEB` | Overdue, missing required evidence |
| `--status-info` | `#185FA5` bg `#E6F1FB` | Informational, FHIR resource labels |

### 6.3 Responsive Layout

- Desktop (≥1024px): max-width content area, KPI tiles in a 4-column row
- Tablet (768–1023px): KPI tiles in a 2-column grid
- Mobile (<768px): KPI tiles stacked
- The justification modal scrolls within itself on small screens

### 6.4 Accessibility

- All interactive elements keyboard-navigable
- Urgency markers use icon AND text label (not color alone) — `⚠` + "overdue", `⦿` + "this week", etc.
- ARIA labels on icon-only markers
- The "AI-generated draft, requires physician review" banner is non-dismissible
- Minimum contrast ratio: 4.5:1 normal text, 3:1 large text

### 6.5 Loading States

- Dashboard: skeleton tiles + skeleton worklist while the parallel prefetch resolves
- Patient detail: each medical-history section loads independently
- Justification modal: skeleton with progress message ("Gathering FHIR evidence and drafting justification…")
- Errors are per-section, not full-page

---

## 7. Performance Requirements

### 7.1 FHIR API Strategy

| Requirement | Implementation |
|---|---|
| Server-side proxy | All FHIR calls flow `browser → Next.js Route Handler → FHIR`. FHIR URL + tokens are server-only and never reach the browser. The proxy enforces a resource-path allowlist. |
| Parallel fetching | Dashboard does a two-stage prefetch: patients (Stage 1), then active-meds-across + preauth-claims-for in parallel (Stage 2). Patient detail prefetches all clinical resources via `Promise.all`. The justification builder gathers its evidence bundle in parallel. |
| Cross-patient queries | One bundle per resource type, scoped via comma-OR'd patient IDs (`?patient=Patient/A,Patient/B,…`) — avoids N+1. |
| Caching | TanStack Query caches responses for 60s with stale-while-revalidate. |
| First paint | Server-prefetched + dehydrated state means first paint shows real worklist rows and KPI numbers, not skeletons. |

### 7.2 Target Metrics

| Metric | Target |
|---|---|
| Time to interactive (dashboard) | < 2s on 4G |
| Patient detail page load | < 2s after navigation |
| Justification builder fully loaded | < 8s after click (FHIR fetch + LLM round-trip) |
| Search debounce | 300ms |

### 7.3 Error Handling

- FHIR server timeout: 10s, then error state with retry per section
- Partial data: if `DocumentReference` is unavailable, the justification builder still works with what it has and notes the gap
- LLM provider error: surface the upstream message to the modal and offer a retry button

---

## 8. Deployment Requirements

- Application deployed to a publicly accessible URL before submission (Vercel, Netlify, or Render)
- FHIR server: configurable to any FHIR R4 server via `FHIR_BASE_URL`. Current demo points at the Medblocks tenant.
- `FHIR_BASE_URL` — **server-only** (no `NEXT_PUBLIC_` prefix). The FHIR URL never reaches the browser.
- `FHIR_SERVER_TOKEN` — optional server-only env var; forwarded as `Authorization: Bearer <token>` when set. Required for tenanted servers.
- `GEMINI_API_KEY` — server-only, used by the justification builder.
- README must include the live URL, how to run locally, env-var list, and the FHIR server in use.

---

## 9. Out of Scope (Do Not Build)

- A static "rule catalog" of drugs/procedures that require PA. PA-required determination is payer-specific. The doctor decides what to PA from the worklist; the app's value is assembly, not gatekeeping.
- A real payer endpoint that returns `ClaimResponse`. We follow the Da Vinci PAS request shape but write the `Claim` to the same FHIR server as the audit-of-record; in production it would POST to the payer's `$submit` endpoint and surface `ClaimResponse.outcome` on the worklist. No CRD/DTR integration.
- Multi-payer rule normalization.
- Patient-facing notifications or PA status push.
- Authentication / login (not required by the challenge; production would use SMART on FHIR EHR launch).
- e-Prescribing network integration (Surescripts, RxConnect).
- Real-time websocket updates (polling on window focus is sufficient).
- PDF export of the justification packet.
- Appeal workflow for denied requests.
- `CoverageEligibilityRequest` (no payer endpoint to call against; would require a real CRD-compatible payer).

---

## 10. Judging Criteria Alignment

| Criterion | How the app addresses it |
|---|---|
| **Basic requirements** | Cross-patient dashboard with KPI tiles + PA worklist. Patient list + detail with full FHIR-driven medical history. Workflow-side feature: detect outstanding PA work (via the active-meds × PA-Claim cross-reference), assemble the justification packet on click, submit via FHIR write-back as a Da Vinci PAS `Claim`. |
| **Performant FHIR APIs** | Cross-patient queries via comma-OR list (single bundle for all panel meds; single bundle for all panel PA Claims) — avoids N+1. Two-stage server prefetch (patients → then meds+PA-claims in parallel). Per-patient detail prefetches all clinical resources via `Promise.all`. Caching via TanStack Query. Resource-path allowlist at the BFF. |
| **Deployed & accessible** | Vercel/Netlify deploy with public URL, env-var-driven FHIR endpoint and LLM key. Demo data: 10 Synthea-generated patients pre-loaded on the Medblocks tenant. |
| **Visual design + UI/UX** | Inbox-first dashboard layout. Status-coded urgency (overdue red / this-week amber / fresh slate / submitted green). KPI tiles for quick status read. Collapsible medical-history sections with raw-JSON inspection for transparency. Sticky demographics bar on detail. Independent section loading. Responsive layout. |
| **Business use-case** | PA costs the US healthcare system $13B/year and is the #1 admin burden physicians cite. The CMS Interoperability and Prior Authorization rule (CMS-0057-F) mandates payer-side FHIR support by 2027. The dashboard shape — inbox of outstanding PA work across the panel — is exactly how practices actually surface this workflow today, made dramatically faster by FHIR-native data access + LLM-assisted assembly. |
