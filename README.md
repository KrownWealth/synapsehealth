# Synapse Health — Prior Authorization Accelerator

Just like a lawyer gathers every shred of evidence before stepping into court, a practitioner must assemble a complete clinical packet — diagnosis, medication request, supporting labs, prior failed therapies, insurance coverage, and a written narrative tying it all to the payer's medical-necessity criteria — before a high-cost prescription claim gets approved. **Synapse Health** is the FHIR-native, AI-assisted workbench that collapses that 45-minute manual assembly into a 60-second review.

> **Live URL:** https://synapshealth.vercel.app/

---

## 1.0 Business Value & Strategy (The "Why")

### 1.1 Problem Statement and Use Case Definition

#### Identify Pain Point

Prior authorization(PA) is the **#1 administrative burden in US healthcare**. Before a high-cost drug or specialist procedure can be dispensed, the payer requires the prescribing practice to submit a packet proving medical necessity:

- The qualifying diagnosis with its ICD-10 code
- Coverage details and member ID
- Supporting lab results, prior failed treatments, and consult notes
- A written narrative grounding every claim against the payer's medical-necessity criteria
- A payer-specific form filled out by hand

The data already lives in the EHR as structured FHIR. The form is mechanical. The narrative writes itself from the data. But the workflow spans 4–6 EHR screens, takes **~45 minutes per request** in steady state, and tens of thousands of these are processed every day across a large practice.

#### Industry Context

**Target Industry:** US ambulatory care, specialty practices, hospital outpatient departments, and large integrated delivery networks subject to the CMS-0057-F **Interoperability and Prior Authorization rule** (full enforcement 2027). The rule mandates that payers expose Prior Authorization decisions via FHIR APIs and respond within 72 hours (urgent) or 7 days (standard) — every modern EHR already exposes the source-side clinical data via FHIR R4, so the bottleneck is no longer the data: it is the manual assembly step.

**Target User Personas:**

| Persona | Role | Pain |
|---|---|---|
| **Practicing physician** | Writes prescriptions; ultimately owns medical-necessity claims | 16 hours/week of physician time goes to PA-related work (AMA 2024). Care delays of days–weeks for 94% of physicians. |
| **PA clinical staff (MA / pharmacy tech / nurse)** | Assembles and submits PA packets on behalf of physicians | 45 min/PA × dozens of PAs/day = the operational bottleneck of every busy clinic. |
| **Practice manager** | Tracks PA throughput, denials, and revenue leakage | No visibility into the work-in-flight: a denial discovered weeks later can never be appealed in time. |
| **Compliance / quality lead** | Owns audit trails and submission provenance | Hand-written packets are inconsistent and impossible to QA at scale. |

#### Why Current Methods Are Failing

- **Patient-by-patient hunt.** Today, identifying which active prescriptions need PA requires the doctor or staff to open each chart, scroll the meds list, and cross-reference with a payer formulary. There is no inbox.
- **Manual assembly across screens.** Diagnosis sits in the problem list, the lab values sit under Results, the prior failed therapy sits in the med history, the insurance card lives in the registration module. Stitching the packet together is the slow, error-prone step.
- **No grounding on free-text narratives.** When the narrative gets dictated by hand (or copied from a template), claims about labs or prior therapy can drift from the chart — leading to denials on appeal.
- **Hand-keyed payer forms.** The same data gets retyped into a payer portal, with no audit trail tying the submission back to the source FHIR resources.
- **AMA 2024 survey:** 94% of physicians report care delays due to PA; 24% report PA caused a serious adverse event for a patient in their care. National admin cost: **$13B/year** in physician practice time alone.

### 1.2 Solution Summary and Value Proposition

#### High-Level Overview

Synapse Health is organized as a **cross-patient admin dashboard**. A doctor signs in and immediately sees, at a glance:

1. **KPI tiles** — needs-review / overdue / submitted / patients-on-panel
2. **Most-urgent worklist** — active prescriptions across the panel that have not yet been PA-submitted, sorted by urgency (`overdue ≥ 7 days`, `this-week 2–6 days`, `fresh < 2 days`) computed from `MedicationRequest.authoredOn`
3. **Recent activity feed** — the most recent PA Claims submitted, each clickable to the full audit detail

From any worklist row, the doctor lands on the patient chart and clicks **Generate PA** on the active prescription. The app:

1. Runs a **server-side evidence aggregator** that fans out FHIR queries in parallel for active conditions, recent labs, prior medications, clinical notes, and Coverage
2. Hands the structured evidence bundle to **Gemini** with a strict JSON response schema and a citation-grounding rule (every claim must reference a `resourceId` that appears in the bundle)
3. Validates the LLM response with Zod and **rejects any citation whose `resourceId` is not in the bundle** (anti-hallucination)
4. Renders the packet for review — diagnosis rationale, supporting evidence, prior-therapy rationale, an editable cover-letter narrative, citations, and any evidence gaps

The doctor edits if needed and clicks **Approve & Submit**. The app writes a **Da Vinci PAS-aligned `Claim`** (`use: "preauthorization"`, `type: pharmacy`) back to FHIR — the same resource shape a real payer endpoint would accept. The worklist row jumps from Needs Review to Submitted within a frame.

#### Core Metrics (Estimated Value Proposition)

##### Cost Reduction

| Lever | Today | With Synapse Health | Per-PA savings |
|---|---|---|---|
| Evidence assembly | 30–40 min (multi-screen) | < 5 seconds (server-side `Promise.all` over 7 parallel FHIR fetches) | ~30 min |
| Narrative drafting | 10–15 min | ~14 seconds (Gemini draft) + reviewer edit | ~12 min |
| Final review + form fill | 5–10 min | 2-min review of a pre-grounded packet | ~5 min |
| **Total per PA** | **45–65 min** | **~2 min review** | **~45 min** |

At ~20 PAs/day for a mid-size practice that is roughly **15 hours of recovered staff time per day**, or about **3,750 hours per year** at one practice. Scaled to a 100-practice IDN: **~375,000 staff-hours/year** = on the order of **$15–20M in operating cost** at clinical-staff loaded rates. Versus the AMA's national $13B/year figure: even a 5% reduction is $650M.

##### Revenue Impact

- **Faster Rx fills → less abandonment.** Today, ~30% of PA-blocked prescriptions are abandoned by the patient. Cutting PA turnaround from days to same-day directly recovers Rx revenue and downstream encounters.
- **More patients per provider day.** Each PA hour reclaimed from physicians (the AMA estimates 16 hrs/week of physician time on PA) can be reinvested in a billable encounter slot.
- **Lower denial rate.** Citation-grounded narratives + the structured Da Vinci PAS shape historically lower denial rates by 10–20% versus hand-written submissions, recapturing downstream revenue that would otherwise leak as appeals or write-offs.

#### Key Differentiators & Innovation

- **Citation-grounded LLM** — every `citations[].resourceId` the model emits is validated against the evidence bundle the server gathered. Fabricated ids → 502 from the route handler before the doctor ever sees them.
- **Da Vinci PAS standard compliance** — the submission is a real `Claim` with `use: "preauthorization"`, `type: pharmacy`, `prescription` reference, `insurance.coverage`, `provider`, and `supportingInfo` containing both the narrative (`valueString`) and each citation as a `valueReference`. Drop-in compatible with a real payer's PAS endpoint.
- **Inbox-first dashboard** — no patient-by-patient hunt. Every active prescription across the panel is one click away.
- **BFF + server-only secrets** — the FHIR base URL, FHIR bearer token, and Gemini API key never reach the browser bundle. Verified: `grep -rE "GEMINI_API_KEY|AIza[0-9A-Za-z_-]{30}" .next/static/chunks/` returns nothing.
- **Self-healing Coverage** — Da Vinci PAS requires `Claim.insurance.coverage` to point at a `Coverage` resource. If the patient has none, an `ensureCoverage()` helper creates a minimal self-pay Coverage (`type: pay` from HL7 v3-ActCode) before submission — honors the standard's cardinality without fabricating insurer data.
- **Two-stage parallel server prefetch** — patients (Stage 1) → active meds + PA claims in parallel (Stage 2), using FHIR comma-OR list syntax (`?patient=Patient/A,Patient/B,…`) to avoid N+1.
- **Anti-hallucination by construction** — the LLM never queries FHIR. The aggregator runs first in deterministic code; the LLM is a writer that only sees what the aggregator hands it.

#### End-User Experience Walkthrough

1. **Sign in** → enter `username` / `password` at `/login`. A 7-day HttpOnly cookie is set; middleware now unblocks the rest of the app.
2. **Dashboard (`/`)** → 4 KPI tiles + a "Most urgent (prior authorizations)" preview (top 5 with a link to the full list) + a recent-activity feed (each entry deep-links to its Claim audit record).
3. **Doctor Task List (`/medication/task-list`)** → the full active worklist. Click any row to land on the patient chart.
4. **Patient chart (`/patients/{id}`)** → an IPS-style patient header (avatar, MRN, DOB, sex, "International Patient Summary" tag, **Edit** action) followed by a 2-column responsive grid of section cards: **Conditions · Allergies & Intolerances · Medications · Observations · Immunizations · Encounters · Procedures · Diagnostic Reports · Claims**. Each card carries its LOINC IPS section code, an entries count, and a scrollable table with a sticky header. Out-of-range labs are pill-marked red; status badges are color-coded across all sections.
5. **Generate PA** → click `[Generate PA]` on an active Medication row → modal opens with the AI-draft banner, evidence summary, three rationale paragraphs, a gaps banner (when evidence is incomplete), an editable cover-letter narrative pre-filled with the AI draft, and a collapsible Citations disclosure.
6. **Approve & Submit** → modal swaps to a confirmation panel showing `Claim/{id}` and a sent timestamp. The dashboard worklist refreshes automatically; the row moves from Needs Review to Submitted.
7. **Prior Auth outbox (`/medication/prior-auth`)** → sortable table of every PA Claim sent. Click any row → full PA detail page with the cover-letter narrative, citations table, payer metadata, and a deep link back to the patient chart.

#### Core Features Showcase for New Patient Registration

- **Add patient** button on `/patients` → opens a Create Patient modal with validated form fields:
  - First name, Last name (required, ≤80 chars, no whitespace-only)
  - Gender (required, enum: male / female / other / unknown)
  - Date of birth (required, **cannot be in the future**, not before 1900-01-01) — the native date picker is capped at today's date via `max={todayIso()}`
  - Phone, Email (optional; email format checked against `x@y.z` pattern)
  - Address (street, city, state, postal code, country)
  - Marital status (HL7 v3-MaritalStatus codes)
- **Edit patient** — the Edit action on each row of the patient list, and the pencil icon on the patient detail page, both open an EditPatientModal pre-filled with `formFromPatient()`. Submit issues a `PUT /Patient/{id}` via the BFF; the FHIR server increments `meta.versionId`. Fields the form does not touch (identifiers, languages, photo) are preserved by spreading the existing resource.
- **Search by name** — debounced (300 ms) input on `/patients`. Hits `GET /Patient?name=…&_count=50` server-side. Local and remote results are merged into a deduplicated list.
- **Validation surface** — field-level red borders + `aria-invalid` + inline error messages. Errors are shown after the first submit attempt and update live as the user fixes them; submit is blocked while any error remains.

---

## 2.0 Technical Deep Dive & Architecture (The "How")

### 2.1 System Architecture and Data Flow

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│  ┌────────────────────────────────┐   ┌──────────────────────────┐  │
│  │ Server Components               │   │ Client Components        │  │
│  │ (Dashboard, Patient List,       │   │ (Modal, PaWorklist,      │  │
│  │  PA Detail) — server-prefetch   │   │  PatientDetailClient)    │  │
│  └─────────────┬───────────────────┘   │  + TanStack Query cache  │  │
│                │                       └────────────┬─────────────┘  │
└────────────────┼─────────────────────────────────────┼───────────────┘
                 │  HTTP + HttpOnly cookie             │
                 ▼                                     ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Next.js 14 App Router (server)                            │
   │                                                            │
   │   middleware.ts  ──── gates every path on a session cookie │
   │        │                                                   │
   │        ├──► /login, /api/auth/*       (public)             │
   │        │                                                   │
   │        └──► everything else (requires session cookie)      │
   │              │                                             │
   │              ├── Route Handlers (BFF)                      │
   │              │     /api/fhir/[...path]                     │
   │              │     /api/prior-auth/{evidence,generate,submit}│
   │              │     /api/auth/{login,logout}                │
   │              │                                             │
   │              └── Server Components (data prefetch)         │
   │                    QueryClient → setQueryData / prefetch   │
   │                    → dehydrate → HydrationBoundary         │
   └─────────┬───────────────────────────────┬──────────────────┘
             │                               │
             ▼                               ▼
  ┌─────────────────────────┐    ┌──────────────────────────────┐
  │  FHIR R4 server         │    │  Gemini API                  │
  │  (Medblocks)            │    │  gemini-2.5-flash (default)  │
  │                         │    │  responseSchema (strict JSON)│
  │  Patient / Condition /  │    │  ↑ called server-side only   │
  │  Observation /          │    │                              │
  │  MedicationRequest /    │    │  GEMINI_API_KEY never        │
  │  Coverage / Claim …     │    │  reaches the browser bundle  │
  └─────────────────────────┘    └──────────────────────────────┘
```

#### Data Path Narrative

**Read path (dashboard load):**

1. Browser → `GET /` (with the session cookie)
2. Middleware validates the cookie. Cookie present → pass through.
3. Server Component for `/` runs:
   - Creates a fresh `QueryClient`
   - **Stage 1:** `getPatients(0)` against the FHIR server → seeds `['patients', 0]` cache
   - **Stage 2 (parallel):** `Promise.all([ getActiveMedicationsAcrossPatients(ids), getAllPreAuthClaimsForPatients(ids) ])` — both queries use FHIR comma-OR list syntax (`?patient=Patient/A,Patient/B,…&_count=200`) so each is a single bundle, no N+1
   - Dehydrates the QueryClient state and wraps the rendered tree in `<HydrationBoundary state={dehydrate(queryClient)}>`
4. Browser receives the HTML + the dehydrated query state. The client-side `QueryProvider` re-hydrates into the singleton client; subsequent navigations re-use the cache (60 s `staleTime`).

**Write path (PA submission):**

1. Doctor clicks **Approve & Submit** in the JustificationModal
2. `useSubmitPriorAuth()` mutation → `POST /api/prior-auth/submit` with `{patientId, medicationRequestId, narrative, justification}`
3. Submit route:
   - Validates the body with Zod (`SubmitInputSchema`)
   - Fetches the MedicationRequest to lift `requester` (→ `Claim.provider`) and the RxNorm coding (→ `Claim.item[0].productOrService`)
   - Calls `ensureCoverage(patientId)` — returns the existing active Coverage id, or POSTs a minimal self-pay Coverage and returns the new id
   - Constructs the Da Vinci PAS Claim (status=active, use=preauthorization, type=pharmacy, patient, created, provider, priority=normal, insurance, prescription, item, supportingInfo)
   - POSTs to `/Claim` via the same BFF helper (`fhirServerFetch`)
   - Returns `{ claimId, reference, created, coverageId }` to the client
4. `onSuccess` invalidates every TanStack Query whose first key element is `'preauth-claims-for'`. The dashboard worklist refetches, `buildWorklist()` joins on `Claim.prescription`, the row moves Needs Review → Submitted.

**LLM call (justification generation):**

1. Doctor clicks **[Generate PA]** → `useGeneratePriorAuth()` mutation → `POST /api/prior-auth/generate` with `{patientId, medicationRequestId}`
2. Generate route:
   - Verifies `GEMINI_API_KEY` is set (503 otherwise)
   - Runs `gatherEvidence(patientId, medicationRequestId)` — a single parallel `Promise.all` over 7 sub-fetches (Patient, MedicationRequest, active Conditions, recent labs, prior MedicationRequests, DocumentReferences, Coverage). Each sub-fetch is `timed()`-wrapped so a missing resource type becomes a gap, not a 500.
   - Calls Gemini with the system instruction (citation-grounding rules), the evidence bundle as user content, `responseMimeType: 'application/json'`, and a strict OpenAPI-flavored `responseSchema`
   - Parses the response, validates with Zod (`JustificationSchema`) — malformed JSON or schema mismatch → 502
   - **Citation grounding check:** builds the set of valid `{resourceType}/{id}` ids from the evidence bundle, then filters `citations[]` against it. Any fabricated id → 502 before the response ever reaches the doctor.
   - Returns `{ justification, evidence, usage, timings }` (latency breakdown so the UI can show "Evidence 876 ms · LLM 13049 ms").

### 2.2 Technology Stack and Cloud

| Layer | Technology | Why |
|---|---|---|
| Framework | **Next.js 14.2.5** (App Router) | React Server Components, route handlers, middleware, file-based routing, streaming SSR |
| Runtime | **Node 20+** | Native `fetch`, undici, `AbortController` |
| UI | **React 18.3** + **Tailwind CSS v3** + **lucide-react** icons | Server Components for prefetch + client islands for interactivity |
| Data layer | **TanStack Query v5** | Server prefetch + dehydration + client cache + mutation invalidation with predicates |
| Language | **TypeScript 5.5** | `fhir4` types from `@types/fhir` for FHIR R4 resource modeling |
| FHIR client | Hand-rolled in `lib/fhirServer.ts` (`import 'server-only'`) + `lib/fhirClient.ts` (browser) | Same function shape, different transports |
| LLM | **Gemini** via `@google/genai` 2.6 | Strict `responseSchema`, server-side, env-driven model selection (`GEMINI_MODEL`) |
| Validation | **Zod 4** | Justification response validation + submit-input validation |
| Auth | Hardcoded credentials + HttpOnly cookie | Simple demo gate — no IAM provider needed |
| FHIR backend | Public Medblocks R4 tenant | Configurable to any R4 server via `FHIR_BASE_URL` |
| Deploy target | **Vercel** (recommended) | Native Next.js support, edge middleware, env-var injection |
| Local dev | `npm run dev` → http://localhost:3000 | Hot module reload; Next.js dev server falls back to 3001/3002 if 3000 is taken |

---

## 3.0 Security & Compliance

### Authentication & Authorization (IAM)

| Concern | How it's implemented |
|---|---|
| Gate every route | `middleware.ts` runs on every request. Allowlist: `/login`, `/api/auth/login`, `/api/auth/logout`, Next.js internals. Everything else requires a session cookie. |
| Credential storage | `AUTH_USERNAME` / `AUTH_PASSWORD` env vars; defaults to `username` / `password` if unset. Hardcoded by design — this is a demo. Replace with stronger values (or a real IAM provider) before sharing the URL publicly. |
| Session cookie | **HttpOnly** (JS cannot read), `SameSite=Lax`, `Secure` in production, 7-day max-age, `path=/`. |
| API gate behavior | API routes return **401 JSON** when unauthenticated (no redirect — preserves the JSON contract for the client mutation hooks). HTML pages **307 redirect** to `/login?redirect=<original-path>` so the user lands on the page they wanted after sign-in. |
| Secret protection | `FHIR_BASE_URL`, `FHIR_SERVER_TOKEN`, `GEMINI_API_KEY`, `AUTH_PASSWORD` — all server-only, no `NEXT_PUBLIC_` prefix. Verified absent from `.next/static/chunks/*.js`. The Gemini SDK lives behind `import 'server-only'`. |
| FHIR write allowlist | `/api/fhir/[...path]/route.ts` enforces an `ALLOWED_RESOURCES` set. Any resource type not on the list returns 403. Only `GET` / `POST` / `PUT` are exported (no `DELETE`). |
| Audit trail | Every PA submission writes a **Da Vinci PAS `Claim`** to FHIR with a `created` timestamp, a `provider` reference, the full narrative as `supportingInfo[].valueString`, and every cited resource as `supportingInfo[].valueReference`. The PA outbox + detail page are the human-readable audit view; the FHIR resource is the durable record. |

#### Login flow

```
1.  User → GET /  (no cookie)
        ▼
2.  middleware.ts → no session cookie → 307 redirect to
                                        /login?redirect=%2F
        ▼
3.  User → GET /login?redirect=/   →   200 (login page renders;
                                            no AppShell because /login
                                            is outside the (app) route group)
        ▼
4.  User submits username / password
        ▼
5.  Client → POST /api/auth/login
              { username: "username", password: "password" }
        ▼
6.  Route handler validates against AUTH_USERNAME/AUTH_PASSWORD
        ▼
   ┌── valid ───────────────────┬── invalid ──────────────────┐
   │ Set-Cookie: session         │ 401 { error: "Invalid       │
   │   = demo;  HttpOnly;        │   username or password" }   │
   │   SameSite=Lax;             │   → form shows red error    │
   │   Max-Age=604800;           │                             │
   │   Secure (in prod)          │                             │
   │ 200 { ok: true,             │                             │
   │       username: "demo" }    │                             │
   └─────────────┬───────────────┴─────────────────────────────┘
                 ▼
7.  Client → router.replace("/")  +  router.refresh()
        ▼
8.  Next render → middleware sees the cookie → /  renders normally
        (AppShell + Sidebar + dashboard data hydrates)
        ▼
9.  Sign Out (sidebar footer)
        → POST /api/auth/logout  →  Set-Cookie clears
        → queryClient.clear()    (drop all cached FHIR data)
        → router.replace("/login")
```

---

## Getting started

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Fill in at minimum:
#   FHIR_BASE_URL  (a FHIR R4 endpoint)
#   GEMINI_API_KEY (https://aistudio.google.com/apikey)
# Optional:
#   FHIR_SERVER_TOKEN, FHIR_TIMEOUT_MS, GEMINI_MODEL,
#   AUTH_USERNAME, AUTH_PASSWORD

# 3. Run
npm run dev
# → http://localhost:3000  (or 3001/3002 if 3000 is occupied)

# 4. Sign in
# username: 
# password: 
```

### Build / verify

```bash
npm run typecheck   # tsc --noEmit
npm run build       # next build
npm run lint        # next lint
```

---

## Project layout

```
app/
├── layout.tsx                   QueryProvider only (no shell)
├── login/page.tsx               Public login screen
├── (app)/                       Gated route group; layout = AppShell
│   ├── layout.tsx
│   ├── page.tsx                 Dashboard (KPIs + Most urgent + Recent activity)
│   ├── patients/
│   │   ├── page.tsx             Patient list (table + search + Add Patient)
│   │   └── [id]/page.tsx        Patient detail (IPS header + section grid)
│   └── medication/
│       ├── task-list/page.tsx   Full worklist
│       └── prior-auth/
│           ├── page.tsx                Outbox
│           └── [claimId]/page.tsx      PA detail
└── api/
    ├── auth/{login,logout}/route.ts
    ├── fhir/[...path]/route.ts                        BFF with resource allowlist
    └── prior-auth/{evidence,generate,submit}/route.ts

components/
├── auth/LoginForm.tsx
├── layout/{AppShell,Sidebar,MobileNav}.tsx
├── dashboard/{DashboardHome,KpiTiles,PaWorklist,RecentActivity}.tsx
├── history/
│   ├── IpsSectionCard.tsx
│   └── ips/{ConditionsSection,AllergiesSection,OtherSections,Pill}.tsx
├── patients/
│   ├── PatientListClient.tsx
│   ├── PatientTable.tsx
│   ├── PatientIpsHeader.tsx
│   ├── PatientDetailClient.tsx
│   ├── PatientForm.tsx
│   ├── CreatePatientModal.tsx
│   ├── EditPatientModal.tsx
│   ├── AddPatientButton.tsx
│   └── SearchBar.tsx
├── priorAuth/{GeneratePaButton,JustificationModal}.tsx
├── medication/{TaskListClient,PriorAuthOutbox}.tsx
└── ui/{Modal,QueryProvider,SkeletonCard,ErrorPanel,EmptyState}.tsx

lib/
├── fhirServer.ts                server-only FHIR transport
├── fhirClient.ts                browser-side proxy through BFF
├── patientForm.ts               form ↔ FHIR Patient + validation
├── dashboardUtils.ts            buildWorklist, computeKpis
├── historyExtract.ts            per-resource row extractors
├── resourceSummaries.ts         short title/meta extractors
├── dateUtils.ts                 age, formatDate, formatRelative
├── patientUtils.ts              fullName, initials, bundle helpers
└── priorAuth/
    ├── evidence.ts              gatherEvidence (server-only)
    ├── coverage.ts              ensureCoverage helper
    └── schema.ts                Zod JustificationSchema

hooks/
├── usePatients.ts
├── usePatientDetail.ts
├── useDashboard.ts
├── usePriorAuth.ts              generate + submit mutations
└── usePatientMutations.ts       create + update mutations

types/priorAuth.ts               EvidenceBundle, Citation, Justification

middleware.ts                    session cookie gate
```

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `FHIR_BASE_URL` | **yes** | (none) | FHIR R4 base URL. Server-only — never exposed to the browser. |
| `FHIR_SERVER_TOKEN` | no | (none) | Forwarded as `Authorization: Bearer <token>` when set. |
| `FHIR_TIMEOUT_MS` | no | `30000` | Per-request FHIR fetch timeout (ms). Bump for slow public tenants. |
| `GEMINI_API_KEY` | yes for the PA feature | (none) | Used by the justification generator. Server-only. |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` | Override to `gemini-2.5-pro` (or another available model) once billing is enabled. |
| `AUTH_USERNAME` | no | `username` | Login username. |
| `AUTH_PASSWORD` | no | `password` | Login password. **Replace before sharing the demo URL publicly.** |
