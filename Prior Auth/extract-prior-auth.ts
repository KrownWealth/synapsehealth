/**
 * extract-prior-auth.ts
 *
 * Reads Synthea FHIR R4 bundle files from INPUT_DIR,
 * extracts only the resources needed for Prior Authorization,
 * and writes one clean JSON file per patient into OUTPUT_DIR.
 *
 * Usage:
 *   npx tsx extract-prior-auth.ts
 */

import fs from "fs";
import path from "path";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const INPUT_DIR = __dirname;
const OUTPUT_DIR = path.join(__dirname, "extracted");
const MAX_PATIENTS = 20;

// Top-level resource types to keep from each Synthea bundle.
// Synthea (FHIR R4) does NOT emit Coverage, ServiceRequest, or Organization
// as top-level entries in patient bundles:
//   - Coverage and ServiceRequest are `contained` inside ExplanationOfBenefit
//     and are lifted to top-level by liftContainedFromEOB().
//   - Provider Organizations live in hospitalInformation*.json and are
//     resolved per-patient by resolveProviderOrgs().
const NEEDED_TYPES = new Set([
  "Patient",
  "Encounter",
  "Condition",
  "Observation",
  "MedicationRequest",
  "Procedure",
  "AllergyIntolerance",
  "Immunization",
  "DiagnosticReport",
  "DocumentReference",
  "Claim",
  "ExplanationOfBenefit",
]);

// hospitalInformation*.json carries all provider Organizations for the cohort.
// We load it once and reference-match against each patient's Claims/EOBs.
const HOSPITAL_INFO_GLOB = /^hospitalInformation.*\.json$/i;
const ORG_REF_PATTERN =
  /Organization\?identifier=https:\/\/github\.com\/synthetichealth\/synthea\|([0-9a-f-]+)/i;
const SYNTHEA_IDENT_SYSTEM = "https://github.com/synthetichealth/synthea";
const SYNTHETIC_IDENT_SYSTEM = "https://sepsofa.local/synthetic";
// ─────────────────────────────────────────────────────────────────────────────

interface BundleEntry {
  fullUrl?: string;
  resource?: { resourceType: string; id?: string; [key: string]: unknown };
  request?: { method: string; url: string; ifNoneExist?: string };
}

interface FhirBundle {
  resourceType: "Bundle";
  type: string;
  entry?: BundleEntry[];
}

interface PriorAuthBundle {
  resourceType: "Bundle";
  type: "transaction";
  patientFile: string;
  resourceSummary: Record<string, number>;
  entry: BundleEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPatientFile(filename: string): boolean {
  // Synthea names org/practitioner files differently — skip them
  return (
    filename.endsWith(".json") &&
    !filename.startsWith("hospital") &&
    !filename.startsWith("practitioner") &&
    !filename.startsWith("package")
  );
}

function makeRequestBlock(
  resource: BundleEntry["resource"],
): BundleEntry["request"] {
  if (!resource) return { method: "POST", url: "Unknown" };
  return {
    method: "POST",
    url: resource.resourceType,
  };
}

// Synthea hides Coverage and ServiceRequest inside ExplanationOfBenefit.contained.
// FHIR R4 servers expect these as first-class resources, so we lift them.
// Coverage dedupe key: payor display + status (handles patients who switched payers).
// ServiceRequest dedupe key: subject + requester reference (the stubs Synthea emits
// have no code, so the requester is the only distinguishing field).
function liftContainedFromEOB(
  eobEntries: BundleEntry[],
  patientUrn: string,
): BundleEntry[] {
  const lifted: BundleEntry[] = [];
  const seenCoverage = new Set<string>();
  const seenServiceRequest = new Set<string>();

  for (const eobEntry of eobEntries) {
    const eob = eobEntry.resource as
      | { id?: string; contained?: Array<Record<string, unknown>> }
      | undefined;
    if (!eob?.contained) continue;

    for (const c of eob.contained) {
      const rt = c.resourceType as string | undefined;
      if (rt !== "Coverage" && rt !== "ServiceRequest") continue;

      // Promote the contained resource to top-level with a stable id derived
      // from the parent EOB so re-runs of the script produce the same ids.
      const stableId = `${eob.id ?? "eob"}-${(c.id as string) ?? rt.toLowerCase()}`;
      // Attach a synthetic identifier so ifNoneExist can match across re-runs.
      const existingIdents = Array.isArray(c.identifier) ? (c.identifier as unknown[]) : [];
      const promoted: Record<string, unknown> = {
        ...c,
        id: stableId,
        identifier: [
          ...existingIdents,
          { system: SYNTHETIC_IDENT_SYSTEM, value: `${rt}-${stableId}` },
        ],
      };

      if (rt === "Coverage") {
        const payor = (
          (c.payor as Array<{ display?: string }> | undefined)?.[0]?.display ??
          ((c.type as { text?: string } | undefined)?.text ?? "unknown")
        );
        const status = (c.status as string | undefined) ?? "unknown";
        const key = `${payor}|${status}`;
        if (seenCoverage.has(key)) continue;
        seenCoverage.add(key);
        // Ensure beneficiary points at the patient (Synthea's contained
        // Coverage usually does, but normalize defensively).
        if (!promoted.beneficiary) {
          promoted.beneficiary = { reference: patientUrn };
        }
      } else {
        // ServiceRequest — Synthea's contained referral has no `code`, so we
        // dedupe by the (subject, requester) pair.
        const subjectRef =
          (c.subject as { reference?: string } | undefined)?.reference ?? "";
        const requesterRef =
          (c.requester as { reference?: string } | undefined)?.reference ?? "";
        const key = `${subjectRef}|${requesterRef}`;
        if (seenServiceRequest.has(key)) continue;
        seenServiceRequest.add(key);
      }

      lifted.push({
        fullUrl: `urn:uuid:${stableId}`,
        resource: promoted as BundleEntry["resource"],
        request: makeRequestBlock(promoted as BundleEntry["resource"]),
      });
    }
  }

  return lifted;
}

// Load every Organization in hospitalInformation*.json into a map keyed by
// the identifier value Synthea uses in `Organization?identifier=...|<uuid>` refs.
function loadProviderOrgs(
  inputDir: string,
): Map<string, BundleEntry["resource"]> {
  const map = new Map<string, BundleEntry["resource"]>();
  const hospFiles = fs
    .readdirSync(inputDir)
    .filter((f) => HOSPITAL_INFO_GLOB.test(f));

  for (const f of hospFiles) {
    const bundle = JSON.parse(
      fs.readFileSync(path.join(inputDir, f), "utf8"),
    ) as FhirBundle;
    for (const e of bundle.entry ?? []) {
      if (e.resource?.resourceType !== "Organization") continue;
      const identifiers =
        (e.resource.identifier as
          | Array<{ system?: string; value?: string }>
          | undefined) ?? [];
      for (const ident of identifiers) {
        if (ident.value) map.set(ident.value, e.resource);
      }
    }
  }
  return map;
}

// Scan a patient's Claim and EOB entries for `Organization?identifier=...|<uuid>`
// references and return the matched Organizations as top-level entries.
function resolveProviderOrgs(
  claimAndEobEntries: BundleEntry[],
  orgMap: Map<string, BundleEntry["resource"]>,
): BundleEntry[] {
  const matched = new Map<string, BundleEntry["resource"]>();

  const walk = (node: unknown): void => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const ref = obj.reference;
    if (typeof ref === "string") {
      const m = ORG_REF_PATTERN.exec(ref);
      if (m) {
        const uuid = m[1];
        const org = orgMap.get(uuid);
        if (org && !matched.has(uuid)) matched.set(uuid, org);
      }
    }
    for (const v of Object.values(obj)) walk(v);
  };

  for (const e of claimAndEobEntries) walk(e.resource);

  return [...matched.values()].map((org) => ({
    fullUrl: `urn:uuid:${org!.id}`,
    resource: org,
    request: makeRequestBlock(org),
  }));
}

// Walk every Reference field in `node` and remove ones we can't resolve:
//   - urn:uuid: refs that don't have a matching entry in the bundle (CareTeam,
//     CarePlan, Provenance, SupplyDelivery, Device, etc. — types we don't extract)
//   - Conditional refs (`<Type>?identifier=…`) — these depend on unique matches
//     server-side and break when there are duplicate Orgs/Locations/Practitioners
//     from earlier upload runs.
function isUnresolvableRef(ref: string, liveUrns: Set<string>): boolean {
  if (ref.startsWith("urn:uuid:")) return !liveUrns.has(ref);
  if (ref.includes("?identifier=")) return true;
  return false;
}

function stripDanglingReferences(
  node: unknown,
  liveUrns: Set<string>,
  parent?: Record<string, unknown>,
  parentKey?: string,
): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    if (parent && parentKey) {
      const filtered = node.filter((item) => {
        if (!item || typeof item !== "object") return true;
        const ref = (item as { reference?: string }).reference;
        return !(typeof ref === "string" && isUnresolvableRef(ref, liveUrns));
      });
      if (filtered.length !== node.length) parent[parentKey] = filtered;
    }
    for (const item of node) stripDanglingReferences(item, liveUrns);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.reference === "string" && isUnresolvableRef(obj.reference, liveUrns)) {
    delete obj.reference;
  }
  for (const [k, v] of Object.entries(obj)) stripDanglingReferences(v, liveUrns, obj, k);
}

function extractBundle(
  raw: FhirBundle,
  filename: string,
  orgMap: Map<string, BundleEntry["resource"]>,
): PriorAuthBundle | null {
  // 1. Top-level entries whose resourceType is in NEEDED_TYPES (Medication is
  //    NOT in NEEDED_TYPES but is referenced by MedicationRequest.medicationReference,
  //    so we also pull Medication entries since the server needs the target).
  const topLevelEntries = (raw.entry ?? []).filter(
    (e) =>
      e.resource &&
      (NEEDED_TYPES.has(e.resource.resourceType) ||
        e.resource.resourceType === "Medication"),
  );

  // 2. Lift Coverage + ServiceRequest out of every EOB.contained
  const patientEntry = topLevelEntries.find(
    (e) => e.resource?.resourceType === "Patient",
  );
  const patientUrn = patientEntry?.fullUrl ?? `urn:uuid:${patientEntry?.resource?.id}`;
  const eobEntries = topLevelEntries.filter(
    (e) => e.resource?.resourceType === "ExplanationOfBenefit",
  );
  const liftedEntries = liftContainedFromEOB(eobEntries, patientUrn);

  // 3. Skip including Organizations in patient bundles — they're pre-loaded
  //    once via `upload.ts --setup` from hospitalInformation*.json. Including
  //    them here causes duplicate-by-identifier errors.

  // 4. Merge everything into one entry list
  const allEntries: BundleEntry[] = [
    ...topLevelEntries.map((e) => ({
      fullUrl: e.fullUrl,
      resource: e.resource,
      request: e.request ?? makeRequestBlock(e.resource),
    })),
    ...liftedEntries,
  ];

  // 4b. Collect the set of urn:uuid: placeholders that are present in the
  //     bundle (i.e. resolvable by the server during transaction processing),
  //     then strip references to any urn:uuid: that is NOT in that set.
  //     Why: Synthea resources reference CareTeam, CarePlan, Provenance,
  //     SupplyDelivery, etc. by urn:uuid — we don't extract those types, so
  //     those references would dangle and HAPI returns "HAPI-0541 placeholder
  //     not satisfied" on the whole transaction.
  const liveUrns = new Set<string>();
  for (const e of allEntries) {
    if (e.fullUrl) liveUrns.add(e.fullUrl);
  }
  for (const e of allEntries) stripDanglingReferences(e.resource, liveUrns);

  // 4c. Idempotency — for every entry, ensure it has an identifier we can
  //     query against, then set request.ifNoneExist with that identifier.
  //     Synthea resources have identifiers (with the Synthea system) for some
  //     types (Patient, Encounter, Claim, EOB, etc.) but not most others
  //     (Observation, Procedure, Condition, ...). We attach a synthetic
  //     identifier derived from the resource's stable urn:uuid so re-extracts
  //     of the same source data produce the same identifier and re-runs of
  //     the upload become no-ops.
  for (const e of allEntries) {
    if (!e.request || e.request.method !== "POST" || !e.resource) continue;

    const resource = e.resource as { identifier?: Array<{ system?: string; value?: string }> };
    let ident = resource.identifier?.find(
      (i) => i.value && (i.system === SYNTHEA_IDENT_SYSTEM || i.system === SYNTHETIC_IDENT_SYSTEM),
    );

    if (!ident) {
      // Derive a stable synthetic identifier from the entry's urn:uuid (which
      // Synthea generates once and never changes for a given source bundle).
      const urnId = e.fullUrl?.startsWith("urn:uuid:")
        ? e.fullUrl.slice("urn:uuid:".length)
        : (e.resource.id ?? `${e.resource.resourceType}-unknown`);
      const synthValue = `${e.resource.resourceType}-${urnId}`;
      const newIdent = { system: SYNTHETIC_IDENT_SYSTEM, value: synthValue };
      resource.identifier = [...(resource.identifier ?? []), newIdent];
      ident = newIdent;
    }

    if (ident.system && ident.value) {
      e.request.ifNoneExist = `identifier=${ident.system}|${ident.value}`;
    }
  }

  // 5. Now check qualification against the merged set
  const types = new Set(allEntries.map((e) => e.resource!.resourceType));
  if (!types.has("Patient") || !types.has("Coverage")) return null;
  if (!types.has("MedicationRequest") && !types.has("ServiceRequest"))
    return null;

  // 6. Build summary
  const summary: Record<string, number> = {};
  for (const e of allEntries) {
    const t = e.resource!.resourceType;
    summary[t] = (summary[t] ?? 0) + 1;
  }

  return {
    resourceType: "Bundle",
    type: "transaction",
    patientFile: filename,
    resourceSummary: summary,
    entry: allEntries,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function run() {
  // Create output folder if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output folder: ${OUTPUT_DIR}\n`);
  }

  const allFiles = fs.readdirSync(INPUT_DIR).filter(isPatientFile);
  const orgMap = loadProviderOrgs(INPUT_DIR);

  console.log(`Found ${allFiles.length} patient files in input folder.`);
  console.log(`Loaded ${orgMap.size} provider organizations.\n`);

  let saved = 0;
  let skipped = 0;
  let processed = 0;

  for (const file of allFiles) {
    if (saved >= MAX_PATIENTS) break;

    processed++;
    const filePath = path.join(INPUT_DIR, file);

    let raw: FhirBundle;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as FhirBundle;
    } catch {
      console.warn(`  [SKIP] Could not parse ${file}`);
      skipped++;
      continue;
    }

    const result = extractBundle(raw, file, orgMap);

    if (!result) {
      console.log(
        `  [SKIP] ${file} — missing Coverage or no Medication/ServiceRequest`,
      );
      skipped++;
      continue;
    }

    // Name output file after the patient ID for easy reference
    const patientEntry = result.entry.find(
      (e) => e.resource?.resourceType === "Patient",
    );
    const patientId = patientEntry?.resource?.id ?? `patient-${saved + 1}`;
    const outputFile = path.join(OUTPUT_DIR, `prior-auth-${patientId}.json`);

    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), "utf8");

    const summary = Object.entries(result.resourceSummary)
      .map(([k, v]) => `${k}(${v})`)
      .join("  ");

    console.log(`  [${saved + 1}/20] Saved: prior-auth-${patientId}.json`);
    console.log(`         ${summary}\n`);

    saved++;
  }

  console.log("─".repeat(60));
  console.log(`Done.`);
  console.log(`  Processed : ${processed} files`);
  console.log(`  Saved     : ${saved} patient bundles`);
  console.log(`  Skipped   : ${skipped} (no Coverage or no orders)`);
  console.log(`  Output    : ${OUTPUT_DIR}`);
}

run();
