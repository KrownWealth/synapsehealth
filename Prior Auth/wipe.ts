/**
 * wipe.ts — one-shot "start from scratch" data cleanup.
 *
 * Reads the 20 Synthea source IDs from ./extracted/, finds EVERY Patient on
 * the FHIR server matching one of those IDs, and DELETEs them. The 10
 * pre-existing tenant patients (different Synthea IDs) are untouched.
 *
 * Dependent resources (Coverage, Condition, Observation, etc.) tied to the
 * deleted Patients become orphans on the server — Medblocks HAPI doesn't
 * support _cascade=delete, so removing them would mean ~25,000 individual
 * DELETEs. They don't show up in patient-scoped queries so the UI is clean.
 *
 * Usage:
 *   npx tsx wipe.ts --dry-run
 *   npx tsx wipe.ts --yes        Skip confirmation
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

interface SearchBundle {
  entry?: Array<{ resource?: { resourceType: string; id?: string } }>;
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
  console.log(`Synthea source IDs to remove from server: ${syntheaIds.length}\n`);

  // Find every Patient matching one of our Synthea IDs.
  type Match = { syntheaId: string; serverIds: string[] };
  const matches: Match[] = [];
  for (const sid of syntheaIds) {
    const url = `${baseUrl}/Patient?identifier=${encodeURIComponent(SYNTHEA_SYSTEM + "|" + sid)}&_count=100`;
    const bundle = await fhirGet<SearchBundle>(url, headers);
    const serverIds = (bundle.entry ?? []).map((e) => e.resource?.id).filter((x): x is string => !!x);
    matches.push({ syntheaId: sid, serverIds });
  }

  const total = matches.reduce((s, m) => s + m.serverIds.length, 0);
  console.log(`Patient records on server matching those IDs : ${total}\n`);
  for (const m of matches) {
    const marker = m.serverIds.length === 0 ? "—" : `${m.serverIds.length}`;
    console.log(`  ${m.syntheaId}  ${marker}`);
  }
  console.log("");

  if (total === 0) {
    console.log("Nothing to delete. Tenant is already clean for these Synthea IDs.");
    return;
  }

  if (!dryRun && !autoConfirm) {
    const a = await ask(`Delete ALL ${total} Patient records matching the uploaded Synthea IDs? [y/N] `);
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
  for (const m of matches) {
    for (const id of m.serverIds) {
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
