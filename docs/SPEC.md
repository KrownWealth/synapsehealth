# SPEC.md — SepSofa
## Sepsis Early Warning & Patient Intelligence Platform

> **Version:** 1.0  
> **Challenge:** Practitioner-Facing FHIR App  
> **Timeline:** 2 weeks  
> **Judging Criteria Addressed:** Basic requirements · FHIR performance · Deployment · Visual design · Business use-case

---

## 1. Business Case

### The Problem

Sepsis kills **270,000 Americans every year** and costs the US healthcare system **$24 billion annually** — making it the single most expensive condition treated in US hospitals. It is also one of the most time-sensitive: every hour of delayed treatment increases mortality by **7%**.

The clinical challenge is not detection — the criteria for sepsis are well-established and measurable. The challenge is **workflow**. Practitioners managing a ward of 20–30 patients review charts sequentially, often hours apart. By the time a nurse flags deteriorating vitals and a doctor reviews the chart, the sepsis cascade has already advanced.

Existing EHR systems display vitals as raw numbers in isolated chart views. No system aggregates them into a live risk score, ranks patients by urgency, or gives the practitioner a single page that explains *why* a patient is at risk right now.

### The Solution

**SepSofa** is a practitioner-facing clinical dashboard that:

1. Pulls patient vitals from a FHIR server in real time
2. Computes three evidence-based sepsis risk scores simultaneously: **qSOFA**, **SIRS**, and **NEWS2**
3. Ranks all patients by risk tier so the most critical patient is always at the top of the list
4. Shows a full clinical picture — vitals trends, active conditions (infection source), active medications (antibiotics running?) — on a single patient detail page

### Why This Wins the Business-Case Criterion

- The problem is real, quantified, and widely recognised (NHS, CMS, AHRQ all publish sepsis reduction mandates)
- The solution is entirely achievable with FHIR R4 `Observation`, `Patient`, `Condition`, and `MedicationRequest` resources — no proprietary data required
- The scoring algorithms (qSOFA, SIRS, NEWS2) are published, validated, and used in production hospitals globally
- The feature set maps cleanly to both weeks of the challenge without overreach

---

## 2. Scoring Algorithms

SepSofa computes three scores from FHIR `Observation` resources. All logic is deterministic and requires no external API calls.

### 2.1 qSOFA (Quick Sequential Organ Failure Assessment)

| Criterion | Threshold | Points |
|---|---|---|
| Respiratory rate | ≥ 22 breaths/min | 1 |
| Altered mentation | GCS < 15 / any confusion | 1 |
| Systolic blood pressure | ≤ 100 mmHg | 1 |

**Score range:** 0–3  
**Sepsis suspected:** Score ≥ 2  
**Clinical weight:** Primary trigger. Score ≥ 2 means immediate escalation regardless of other scores.

### 2.2 SIRS (Systemic Inflammatory Response Syndrome)

| Criterion | Threshold | Points |
|---|---|---|
| Temperature | > 38.0°C or < 36.0°C | 1 |
| Heart rate | > 90 bpm | 1 |
| Respiratory rate | > 20 breaths/min | 1 |

> Note: Full SIRS includes WBC count. SepSofa uses the three criteria consistently available in FHIR vital sign observations. This is clearly labelled in the UI as "3-parameter SIRS".

**Score range:** 0–3  
**SIRS met:** Score ≥ 2  
**Clinical weight:** Sensitive early indicator. Fires before qSOFA in many cases.

### 2.3 NEWS2 (National Early Warning Score 2)

| Parameter | FHIR LOINC | 3 pts | 2 pts | 1 pt | 0 pts | 1 pt | 2 pts | 3 pts |
|---|---|---|---|---|---|---|---|---|
| Respiratory rate | 9279-1 | ≤8 | — | 9–11 | 12–20 | — | 21–24 | ≥25 |
| SpO₂ (scale 1) | 59408-5 | ≤91 | 92–93 | 94–95 | ≥96 | — | — | — |
| Supplemental O₂ | — | — | 2 pts if yes | — | 0 if no | — | — | — |
| Systolic BP | 8480-6 | ≤90 | 91–100 | 101–110 | 111–219 | — | — | ≥220 |
| Heart rate | 8867-4 | ≤40 | — | 41–50 | 51–90 | 91–110 | 111–130 | ≥131 |
| Consciousness | — | — | — | — | Alert | — | — | Any other |
| Temperature | 8310-5 | ≤35.0 | — | 35.1–36.0 | 36.1–38.0 | 38.1–39.0 | ≥39.1 | — |

**Score range:** 0–20  
**Risk thresholds:**

| Score | Risk level | Response |
|---|---|---|
| 0 | Low | Routine monitoring |
| 1–4 | Low | Minimum 12-hourly monitoring |
| 5–6 | Medium | Urgent review by ward doctor |
| ≥7 | High | Emergency response team |
| Any single parameter = 3 | Medium minimum | Urgent review |

### 2.4 Composite Risk Tier

SepSofa combines all three scores into a single risk tier displayed as a badge on the patient list:

| Tier | Colour | Condition |
|---|---|---|
| **Critical** | Red | qSOFA ≥ 2 AND NEWS2 ≥ 7 |
| **High** | Orange | qSOFA ≥ 2 OR (NEWS2 ≥ 7 without qSOFA) |
| **Medium** | Amber | SIRS ≥ 2 OR NEWS2 5–6 OR any single NEWS2 parameter = 3 |
| **Low** | Green | All scores below thresholds |

---

## 3. FHIR Resource Mapping

All data is sourced from FHIR R4. No external APIs are required for core functionality.

### 3.1 Patient (`/Patient`)

| UI Field | FHIR Path |
|---|---|
| Full name | `name[0].given + name[0].family` |
| Gender | `gender` |
| Date of birth | `birthDate` |
| Age (computed) | Derived from `birthDate` |

### 3.2 Vital Signs (`/Observation?category=vital-signs`)

| Parameter | LOINC Code | Unit |
|---|---|---|
| Heart rate | 8867-4 | beats/min |
| Respiratory rate | 9279-1 | breaths/min |
| Systolic blood pressure | 8480-6 | mmHg |
| Diastolic blood pressure | 8462-4 | mmHg |
| Body temperature | 8310-5 | °C or °F |
| Oxygen saturation | 59408-5 | % |
| Body weight | 29463-7 | kg or lb |
| Body height | 8302-2 | cm or in |
| BMI | 39156-5 | kg/m² |

### 3.3 Conditions (`/Condition?clinical-status=active`)

| UI Field | FHIR Path |
|---|---|
| Condition name | `code.text` or `code.coding[0].display` |
| Onset date | `onsetDateTime` |
| Clinical status | `clinicalStatus.coding[0].code` |
| Category | `category[0].coding[0].code` |

### 3.4 Medications (`/MedicationRequest?status=active`)

| UI Field | FHIR Path |
|---|---|
| Medication name | `medicationCodeableConcept.text` |
| Dosage | `dosageInstruction[0].text` |
| Prescribed date | `authoredOn` |
| Prescriber | `requester.display` |

---

## 4. Week 1 — Patient Management

### 4.1 Patient List Page (Home)

**Route:** `/`

#### Requirements

- [ ] Display all patients from the FHIR server
- [ ] Show per patient: full name, gender, date of birth, calculated age
- [ ] Show per patient: composite risk tier badge (Critical / High / Medium / Low)
- [ ] Show per patient: qSOFA score as a number badge
- [ ] Show per patient: NEWS2 score as a number badge
- [ ] Default sort: risk tier descending (Critical first), then NEWS2 score descending
- [ ] Secondary sort toggle: alphabetical by last name
- [ ] Search: filter patients by name (first or last) in real time, client-side
- [ ] Pagination or infinite scroll for large patient lists (page size: 20)
- [ ] Loading skeleton cards while FHIR data is fetching
- [ ] Empty state if no patients found
- [ ] Error state if FHIR server is unreachable

#### Risk Badge Display

```
[● Critical]  red background    — qSOFA ≥2 + NEWS2 ≥7
[● High    ]  orange background — qSOFA ≥2
[● Medium  ]  amber background  — SIRS ≥2 or NEWS2 5–6
[● Low     ]  green background  — all clear
```

#### Patient Card Layout

```
┌─────────────────────────────────────────────────────┐
│  [Avatar]  Margaret T. Liu                [● High]  │
│            Female · 67 yrs · DOB 1957-03-12         │
│            qSOFA: 2/3  ·  NEWS2: 6/20               │
└─────────────────────────────────────────────────────┘
```

---

### 4.2 Create Patient

**Route:** `/patients/new`  
**Trigger:** "Add patient" button on the list page

#### Form Fields & Validation

| Field | Type | Validation |
|---|---|---|
| Given name(s) | Text | Required. Min 1 character. Letters, spaces, hyphens only. |
| Family name | Text | Required. Min 1 character. Letters, spaces, hyphens only. |
| Gender | Select | Required. Options: `male`, `female`, `other`, `unknown` |
| Date of birth | Date picker | Required. Cannot be in the future. Cannot be more than 130 years ago. |

**On submit:**
- Validate all fields before sending
- `POST /Patient` with correct FHIR R4 Patient resource body
- Show inline field-level error messages (not toast-only)
- On success: redirect to the new patient's detail page
- On FHIR error: show error message with the FHIR OperationOutcome detail

---

### 4.3 Edit Patient

**Route:** `/patients/:id/edit`  
**Trigger:** Edit button on patient detail page or patient card

- Pre-populate form with existing patient data from FHIR
- Same validation rules as create
- `PUT /Patient/:id` with full updated resource (not PATCH)
- Optimistic UI: update local state immediately, revert on error
- On success: redirect back to patient detail page

---

### 4.4 Search

- Search input at the top of the patient list
- Filter is applied client-side against the already-fetched patient list
- If total patient count exceeds the fetched page, also trigger a server-side `GET /Patient?name=:query` and merge results
- Debounce server-side search: 300ms after last keystroke
- Show "No patients found" with a clear search state if results are empty

---

## 5. Week 2 — Patient Detail Page

**Route:** `/patients/:id`  
**Trigger:** Clicking any patient card on the list

### 5.1 Page Structure

```
┌── Demographics bar (always visible) ─────────────────┐
├── Sepsis Risk Panel ────────────────────────────────── ← SepSofa's headline feature
├── Vital Signs Panel ──────────────────────────────────
├── Vitals Trend Chart ─────────────────────────────────
├── Active Conditions ──────────────────────────────────
└── Active Medications ─────────────────────────────────
```

---

### 5.2 Demographics Bar

Sticky at the top of the page. Always visible while scrolling.

| Field | Source |
|---|---|
| Full name | `Patient.name` |
| Gender | `Patient.gender` |
| Date of birth | `Patient.birthDate` |
| Age | Computed from `birthDate` |
| Risk tier badge | Computed from latest vitals |

---

### 5.3 Sepsis Risk Panel

The primary feature of SepSofa. Displayed immediately below the demographics bar.

**Displays:**
- Composite risk tier with colour-coded banner and recommended action
- qSOFA score (N/3) with each criterion listed and marked met/unmet
- SIRS score (N/3) with each criterion listed and marked met/unmet
- NEWS2 score (N/20) with per-parameter breakdown showing points contributed

**Behaviour:**
- If any score is in Critical or High tier, the panel renders with a prominent coloured border
- Each criterion shows the actual value alongside the threshold (e.g. "RR: 24 br/min ≥ 22")
- Scores are computed from the **most recent** observation for each vital sign parameter

---

### 5.4 Vital Signs Panel

Display the latest recorded value for each vital sign in a grid of metric cards.

| Vital | Normal Range | Flag if |
|---|---|---|
| Heart rate | 60–100 bpm | < 40 or > 130 |
| Respiratory rate | 12–20 br/min | < 8 or > 25 |
| Systolic BP | 100–140 mmHg | < 90 or > 180 |
| Diastolic BP | 60–90 mmHg | < 50 or > 110 |
| Temperature | 36.1–38.0 °C | < 35.0 or > 39.1 |
| SpO₂ | ≥ 96% | < 92 |
| Weight | — | — |
| Height | — | — |
| BMI | 18.5–24.9 | < 16 or > 35 |

**Display rules:**
- Out-of-range values render the card with a red/amber border and coloured text
- Normal values render with a green indicator
- "No data" placeholder if no observation exists for a parameter
- Show timestamp of when each value was last recorded

---

### 5.5 Vitals Trend Chart

A time-series line chart showing the trajectory of key vitals over the last 24 hours (or available history if shorter).

**Chart parameters:**
- X-axis: time (last 24 hours, 4-hour intervals)
- Y-axis: value
- Series: Heart rate, Respiratory rate, Systolic BP (three lines, distinct colours)
- Overlay: NEWS2 score on a secondary axis (bar chart behind the lines)

**Behaviour:**
- Horizontal threshold lines for key clinical cut-offs (e.g. RR = 22, SBP = 100)
- Tooltip on hover showing exact value, timestamp, and NEWS2 contribution for that reading
- "Insufficient data" placeholder if fewer than 2 observations exist

---

### 5.6 Active Conditions

- Fetch from `GET /Condition?patient=:id&clinical-status=active`
- Display as a list: condition name, onset date, category (problem-list-item / encounter-diagnosis / etc.)
- Group by category if more than 5 conditions
- Conditions relevant to sepsis (infections, immunocompromised states) highlighted with an amber left border
- "No active conditions on record" empty state

**Infection flag logic:**  
If any active condition's `code.coding` or `code.text` contains keywords associated with infection (pneumonia, UTI, cellulitis, bacteremia, sepsis, abscess, wound infection), display a "Possible infection source" banner above the conditions list. This contextualises the sepsis risk score.

---

### 5.7 Active Medications

- Fetch from `GET /MedicationRequest?patient=:id&status=active`
- Display as a list: medication name, dosage instruction, date prescribed
- Flag antibiotic medications with a teal badge ("Antibiotic") — if an antibiotic is already active, note this in the sepsis risk panel ("Antibiotic therapy in progress")
- "No active medications on record" empty state

---

## 6. UI/UX Requirements

### 6.1 Design Principles

- **Urgency hierarchy:** The most critical information (risk tier) must be visible without scrolling on any page
- **Speed:** The app must feel instantaneous. Skeletons during load, no empty white screens
- **Density:** Medical professionals process dense information. Cards can be compact — readable but not padded for consumer audiences
- **Colour semantics:** Red = critical/danger, Amber = warning, Green = normal. Never invert these.

### 6.2 Colour System

| Token | Usage |
|---|---|
| `--risk-critical` | `#A32D2D` bg `#FCEBEB` | qSOFA ≥2 + NEWS2 ≥7 |
| `--risk-high` | `#993C1D` bg `#FAECE7` | qSOFA ≥2 |
| `--risk-medium` | `#854F0B` bg `#FAEEDA` | SIRS ≥2 or NEWS2 5–6 |
| `--risk-low` | `#3B6D11` bg `#EAF3DE` | All clear |
| `--fhir-tag` | `#185FA5` bg `#E6F1FB` | FHIR/data source labels |

### 6.3 Responsive Layout

- Desktop (≥1024px): sidebar navigation + main content area
- Tablet (768–1023px): top navigation + full-width content
- Mobile (< 768px): bottom tab bar + stacked content
- The patient list must be usable on a tablet held in portrait orientation (a common clinical device form factor)

### 6.4 Accessibility

- All interactive elements keyboard-navigable
- Risk badges use both colour AND text label (not colour alone)
- Out-of-range vitals flagged with icon AND colour
- ARIA labels on all icon-only buttons
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text

### 6.5 Loading States

- Patient list: skeleton cards (same shape as real cards)
- Patient detail: skeleton for each panel independently — vitals can load while conditions are still fetching
- Error states: clear message + retry button per failed section (not a full-page error)

---

## 7. Performance Requirements

### 7.1 FHIR API Strategy

| Requirement | Implementation |
|---|---|
| Server-side proxy | All FHIR calls flow `browser → Next.js Route Handler → FHIR`. The FHIR URL and any credentials are server-only and never reach the browser. The proxy enforces a resource-path allowlist (`Patient`, `Observation`, `Condition`, `MedicationRequest`) and logs every access. |
| Parallel fetching | Fetch `Patient`, `Observation`, `Condition`, `MedicationRequest` concurrently — never sequentially. On the patient detail page this runs as a server-side `Promise.all` of `prefetchQuery` calls, then hydrates into the client cache. |
| Caching | TanStack Query caches responses for 60 seconds with stale-while-revalidate on revisit |
| Patient list | Use `_count=50` on initial list fetch. Fetch full resources on demand. The first page is server-prefetched so first paint shows real patient cards, not skeletons. |
| Vitals | Request `_sort=-date&_count=20` to get the 20 most recent observations per patient |
| Bundle processing | Use `GET /Patient/:id/$everything` sparingly — prefer targeted resource queries |

### 7.2 Target Metrics

| Metric | Target |
|---|---|
| Time to interactive (patient list) | < 1.5 seconds on 4G |
| Patient detail page load | < 2 seconds after navigation |
| Score computation | < 10ms (synchronous, no async) |
| Search debounce | 300ms |

### 7.3 Error Handling

- FHIR server timeout: 10 seconds, then show error state with retry
- Partial data: if SpO₂ is missing, compute scores from available vitals and note "SpO₂ not recorded — NEWS2 partial"
- Rate limiting: exponential backoff starting at 500ms, max 3 retries

---

## 8. Deployment Requirements

- Application must be deployed to a publicly accessible URL before submission
- Recommended platforms: **Vercel**, **Netlify**, or **Render** (all have free tiers)
- FHIR server: use the public **HAPI FHIR R4** test server (`https://hapi.fhir.org/baseR4`) for the demo
- Environment variable for FHIR base URL so judges can point it at their own server: `FHIR_BASE_URL` — **server-only** (no `NEXT_PUBLIC_` prefix). The FHIR URL is never exposed to the browser; all browser traffic goes through the same-origin BFF at `/api/fhir/*`.
- Optional `FHIR_AUTH_TOKEN` server env var — if set, the BFF forwards it as `Authorization: Bearer <token>` to the FHIR server. Unused for the public HAPI demo build, wired up for any real FHIR server.
- No FHIR-server authentication required for the demo build itself (HAPI is open).
- README must include the live URL, how to run locally, and the FHIR server being used

---

## 9. Out of Scope (Do Not Build)

- Authentication / login (not required by the challenge)
- Write-back of scores to FHIR (scores are computed client-side only)
- WBC / lactate (lab values — not reliably in vital-sign observations on test servers)
- Push notifications or real-time websocket updates (polling on page focus is sufficient)
- Multi-tenant / multi-ward views
- PDF export

---

## 10. Judging Criteria Alignment

| Criterion | How SepSofa addresses it |
|---|---|
| **Basic requirements** | Full CRUD on Patient (list, create, edit, search). Full Week 2 detail page with demographics, vitals, conditions, medications. |
| **Performant FHIR APIs** | Parallel resource fetching, response caching, `_sort` and `_count` query parameters, targeted queries over broad bundle fetches. |
| **Deployed & accessible** | Vercel/Netlify deploy with public URL, environment variable for FHIR base URL, seeded test data documented in README. |
| **Visual design + UI/UX** | Risk-sorted patient list with colour-coded tiers, sticky demographics bar, independent panel loading, clear out-of-range flagging, responsive layout. |
| **Business use-case** | Sepsis kills 270K Americans/year and costs $24B. Every hour of delay increases mortality 7%. SepSofa surfaces risk automatically so practitioners stop missing the window. |