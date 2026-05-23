/**
 * cleanup.ts
 *
 * For each Synthea source patient (the 20 in ./extracted/), find every server
 * Patient that matches the Synthea identifier, keep the most-recently-updated
 * one, and DELETE the others. The latest copy was created by the most recent
 * (most likely complete) upload — its linked Observations, Conditions, etc.
 * stay intact.
 *
 * Dependent resources of the deleted older duplicates become orphans on the
 * server — they don't show up in patient-list queries so the user-visible
 * problem is fixed. The Medblocks HAPI doesn't support _cascade=delete or
 * conditional multi-match delete, so a full cascading cleanup isn't possible
 * without thousands of individual DELETEs.
 *
 * Usage:
 *   npx tsx cleanup.ts --dry-run
 *   npx tsx cleanup.ts --yes        Skip confirmation
 */

import fs from "fs";
import path from "path";
import readline from "readline";

const INPUT_DIR = path.join(__dirname, "extracted");
const ENV_PATH = path.resolve(__dirname, "..", ".env.local");
const SYNTHEA_SYSTEM = "https://github.com/synthetichealth/synthea";

function loadEnv(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) throw new Error(`.env.local not found at ${envPath}`);
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

interface PatientResource {
  resourceType: "Patient";
  id?: string;
  meta?: { lastUpdated?: string };
}
interface SearchBundle {
  entry?: Array<{ resource?: PatientResource }>;
}

async function fhirGet<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/fhir+json", ...headers } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function fhirDelete(url: string, headers: Record<string, string>): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Accept: "application/fhir+json", ...headers },
  });
  return { ok: res.ok, status: res.status };
}

function syntheaIdsFromExtractedBundles(): string[] {
  if (!fs.existsSync(INPUT_DIR)) throw new Error(`No extracted/ at ${INPUT_DIR}`);
  const ids = new Set<string>();
  for (const file of fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith(".json"))) {
    const bundle = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, file), "utf8"));
    const patient = (bundle.entry as Array<{ resource?: { resourceType?: string; identifier?: Array<{ system?: string; value?: string }> } }> | undefined)
      ?.find((e) => e.resource?.resourceType === "Patient")?.resource;
    const ident = patient?.identifier?.find((i) => i.system === SYNTHEA_SYSTEM && i.value);
    if (ident?.value) ids.add(ident.value);
  }
  return [...ids];
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const autoConfirm = args.includes("--yes");

  const env = loadEnv(ENV_PATH);
  const baseUrl = env.FHIR_BASE_URL?.replace(/\/$/, "");
  const token = env.FHIR_SERVER_TOKEN;
  if (!baseUrl) {
    console.error("FHIR_BASE_URL missing from .env.local");
    process.exit(1);
  }
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  console.log(`Target  : ${baseUrl}`);
  console.log(`Dry run : ${dryRun}\n`);

  const syntheaIds = syntheaIdsFromExtractedBundles();
  console.log(`Synthea source IDs (from extracted/): ${syntheaIds.length}\n`);

  type Plan = { syntheaId: string; keep?: { id: string; lastUpdated: string }; deleteIds: string[] };
  const plan: Plan[] = [];

  for (const sid of syntheaIds) {
    const url = `${baseUrl}/Patient?identifier=${encodeURIComponent(SYNTHEA_SYSTEM + "|" + sid)}&_count=100`;
    const bundle = await fhirGet<SearchBundle>(url, headers);
    const copies = (bundle.entry ?? [])
      .map((e) => e.resource)
      .filter((p): p is PatientResource => !!p?.id)
      .map((p) => ({ id: p.id!, lastUpdated: p.meta?.lastUpdated ?? "" }))
      .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
    if (copies.length === 0) {
      plan.push({ syntheaId: sid, deleteIds: [] });
    } else {
      const [keep, ...rest] = copies;
      plan.push({ syntheaId: sid, keep, deleteIds: rest.map((r) => r.id) });
    }
  }

  const totalDelete = plan.reduce((s, p) => s + p.deleteIds.length, 0);
  console.log(`Patients to keep (newest per Synthea ID): ${plan.filter((p) => p.keep).length}`);
  console.log(`Patients to delete (older duplicates)   : ${totalDelete}\n`);

  for (const p of plan) {
    const head = `  ${p.syntheaId.slice(0, 12)}…`;
    if (!p.keep) {
      console.log(`${head}  (none on server)`);
    } else if (p.deleteIds.length === 0) {
      console.log(`${head}  keep ${p.keep.id.slice(0, 8)}…`);
    } else {
      console.log(`${head}  keep ${p.keep.id.slice(0, 8)}… (${p.keep.lastUpdated}), delete ${p.deleteIds.length}`);
    }
  }
  console.log("");

  if (totalDelete === 0) {
    console.log("Nothing to delete. Tenant has at most one copy per Synthea ID.");
    return;
  }

  if (!dryRun && !autoConfirm) {
    const a = await ask(`Delete ${totalDelete} duplicate Patient records? [y/N] `);
    if (a.trim().toLowerCase() !== "y") {
      console.log("Aborted.");
      return;
    }
  }

  if (dryRun) {
    console.log("(dry-run — no DELETE calls were made)");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const p of plan) {
    for (const id of p.deleteIds) {
      const result = await fhirDelete(`${baseUrl}/Patient/${id}`, headers);
      if (result.ok || result.status === 404 || result.status === 410) {
        ok++;
        process.stdout.write(".");
      } else {
        fail++;
        process.stdout.write("x");
      }
    }
  }
  console.log("\n" + "─".repeat(60));
  console.log(`Deleted : ${ok}`);
  if (fail) console.log(`Failed  : ${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
