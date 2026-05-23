# Prior Auth — 

Just like a lawyer would gather all evidence to defend his client in the court of law, so are medical practitioner

Practitioner-facing clinical dashboard that pulls patient data from a FHIR R4 server, computes **qSOFA**, **SIRS**, and **NEWS2** scores in real time, and ranks patients by risk tier so the most critical case is always on top.

> **Live URL:** _add your deployment URL here after `vercel deploy`._

---

## Architecture (BFF)

All FHIR traffic flows **`browser → Next.js Route Handler → FHIR server`**.

- The FHIR base URL lives in the server-only env var `FHIR_BASE_URL` (no `NEXT_PUBLIC_` prefix), so it never reaches the browser bundle.
- The BFF at `/api/fhir/[...path]` enforces a resource allowlist (`Patient`, `Observation`, `Condition`, `MedicationRequest`), emits one structured `fhir_access` audit log per request, and optionally forwards `Authorization: Bearer ${FHIR_AUTH_TOKEN}` if that env var is set.
- Pages prefetch data server-side into a TanStack `QueryClient` and dehydrate it through `<HydrationBoundary>` so first paint shows real patient data; the client hooks use matching query keys and pick up the cache without a refetch.

`lib/fhirServer.ts` (`import 'server-only'`) talks to the real FHIR server. `lib/fhirClient.ts` (browser) talks to `/api/fhir/*`. Same function shape, different transport.

---

## Run locally

```bash
npm install
cp .env.example .env.local      # then edit FHIR_BASE_URL if you want a different server
npm run dev
```

App boots at <http://localhost:3000>.

### Other scripts

```bash
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run start       # serve the production build
```

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `FHIR_BASE_URL` | yes | Server-only. Full base URL of the FHIR R4 server (no trailing slash). |
| `FHIR_SERVER_TOKEN` | no | Server-only. Forwarded as `Authorization: Bearer <token>` when set. Required for tenanted servers (e.g. Medblocks); unused for the public HAPI test server. |

Never prefix these with `NEXT_PUBLIC_` — the BFF exists specifically to keep the FHIR URL and credentials out of the browser bundle.

---

## Deployment (Vercel)

```bash
npm i -g vercel
vercel
vercel env add FHIR_BASE_URL production
# Value: https://hapi.fhir.org/baseR4
```

No `vercel.json` needed — App Router routing is native.

---

## Project layout

```
app/                         App Router pages + API
  api/fhir/[...path]/        BFF — only file that talks to FHIR upstream
  page.tsx                   Patient list (async, prefetches)
  patients/new/              Create form
  patients/[id]/             Detail page (async, parallel prefetch)
  patients/[id]/edit/        Edit form
components/
  layout/AppShell.tsx        Header + main wrapper
  patients/                  PatientListClient, PatientCard, PatientForm, …
  sepsis/                    RiskBadge, SepsisRiskPanel, QsofaScore, SirsScore, News2Score
  vitals/                    VitalsGrid, VitalCard, VitalsTrendChart
  conditions/                ConditionsList (+ infection-source banner)
  medications/               MedicationsList (+ antibiotic flag)
  ui/                        QueryProvider, SkeletonCard, ErrorPanel, EmptyState
hooks/                       TanStack Query hooks; all 'use client', import lib/fhirClient
lib/
  fhirServer.ts              SERVER ONLY (import 'server-only')
  fhirClient.ts              Browser — hits /api/fhir/*
  scoring.ts                 qSOFA / SIRS / NEWS2 — pure TS
  vitalsUtils.ts             LOINC parsing, °F→°C, range checks, trend bucketing
  infectionFlags.ts          Infection keyword + antibiotic detection
  patientSchema.ts           Zod schema + toFhirPatient()
  patientUtils.ts            Name extraction, bundle filtering
  riskConfig.ts              Tier labels, colours, action text
  dateUtils.ts               Age + date formatting
types/scoring.ts             Re-exports of scoring types
```
