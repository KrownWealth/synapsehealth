/**
 * upload.ts
 *
 * Reads bundles and POSTs them to the FHIR server (FHIR_BASE_URL +
 * Authorization: Bearer FHIR_SERVER_TOKEN from ../.env.local). One HTTP call
 * per bundle; the server processes each bundle as a batch.
 *
 * Usage:
 *   npx tsx upload.ts --setup        Upload hospitalInformation + practitionerInformation
 *                                    (one-time; seeds Practitioners + Locations + Orgs)
 *   npx tsx upload.ts                Upload every patient bundle in ./extracted/
 *   npx tsx upload.ts --dry-run      List what would be sent, no POST
 *   npx tsx upload.ts --only=<id>    Upload one patient bundle matching id
 */

import fs from "fs";
import path from "path";

const INPUT_DIR = path.join(__dirname, "extracted");
const ENV_PATH = path.resolve(__dirname, "..", ".env.local");

// ── Env loading ───────────────────────────────────────────────────────────────

function loadEnv(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.local not found at ${envPath}`);
  }
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

// ── HTTP ──────────────────────────────────────────────────────────────────────

interface UploadResult {
  file: string;
  status: number;
  ok: boolean;
  resourceCount: number;
  successEntries: number;
  failureEntries: number;
  durationMs: number;
  error?: string;
  outcome?: unknown;
}

async function uploadBundle(
  baseUrl: string,
  token: string | undefined,
  bundle: { entry?: unknown[] },
  file: string,
): Promise<UploadResult> {
  const started = Date.now();
  const headers: Record<string, string> = {
    Accept: "application/fhir+json",
    "Content-Type": "application/fhir+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(baseUrl.replace(/\/$/, "") + "/", {
      method: "POST",
      headers,
      body: JSON.stringify(bundle),
    });

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text.slice(0, 500);
    }

    const responseEntries =
      ((parsed as { entry?: Array<{ response?: { status?: string } }> })?.entry ?? []);
    const success = responseEntries.filter((e) => /^2\d\d/.test(e.response?.status ?? "")).length;
    const failure = responseEntries.length - success;

    return {
      file,
      status: res.status,
      ok: res.ok && failure === 0,
      resourceCount: bundle.entry?.length ?? 0,
      successEntries: success,
      failureEntries: failure,
      durationMs: Date.now() - started,
      outcome: parsed,
    };
  } catch (err) {
    return {
      file,
      status: 0,
      ok: false,
      resourceCount: bundle.entry?.length ?? 0,
      successEntries: 0,
      failureEntries: bundle.entry?.length ?? 0,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const setupMode = args.includes("--setup");
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const onlyId = onlyArg ? onlyArg.slice("--only=".length) : undefined;

  const env = loadEnv(ENV_PATH);
  const baseUrl = env.FHIR_BASE_URL;
  const token = env.FHIR_SERVER_TOKEN;

  if (!baseUrl) {
    console.error("FHIR_BASE_URL is missing from .env.local");
    process.exit(1);
  }
  console.log(`Target  : ${baseUrl}`);
  console.log(`Auth    : ${token ? "Bearer (token present)" : "none"}`);
  console.log(`Dry run : ${dryRun}\n`);

  let files: string[];
  let sourceDir: string;

  if (setupMode) {
    sourceDir = __dirname;
    files = fs.readdirSync(sourceDir)
      .filter((f) => /^(hospital|practitioner)Information.*\.json$/i.test(f));
  } else {
    sourceDir = INPUT_DIR;
    if (!fs.existsSync(INPUT_DIR)) {
      console.error(`No extracted/ directory at ${INPUT_DIR}. Run extract-prior-auth.ts first.`);
      process.exit(1);
    }
    files = fs.readdirSync(INPUT_DIR)
      .filter((f) => f.endsWith(".json"))
      .filter((f) => !onlyId || f.includes(onlyId));
  }

  if (files.length === 0) {
    console.error(`No bundles to upload in ${INPUT_DIR}${onlyId ? ` matching --only=${onlyId}` : ""}.`);
    process.exit(1);
  }

  console.log(`Found ${files.length} bundles to upload.\n`);

  const results: UploadResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(sourceDir, file);
    const bundle = JSON.parse(fs.readFileSync(filePath, "utf8"));

    if (dryRun) {
      console.log(`  [${i + 1}/${files.length}] would upload ${file} (${bundle.entry?.length ?? 0} entries)`);
      continue;
    }

    process.stdout.write(`  [${i + 1}/${files.length}] ${file.padEnd(50)} `);
    const result = await uploadBundle(baseUrl, token, bundle, file);
    results.push(result);

    const flag = result.ok ? "OK " : "ERR";
    console.log(
      `${flag}  ${result.status}  ${result.durationMs}ms  ` +
      `entries: ${result.successEntries}/${result.resourceCount}` +
      (result.failureEntries ? `  (${result.failureEntries} failed)` : ""),
    );
    if (!result.ok) {
      if (result.error) {
        console.log(`         ${result.error}`);
      } else {
        // Per-entry failure: show the first few distinct error messages
        const responseEntries =
          ((result.outcome as { entry?: Array<{ response?: { status?: string; outcome?: { issue?: Array<{ diagnostics?: string }> } } }> })?.entry ?? []);
        const issues = new Map<string, number>();
        for (const e of responseEntries) {
          if (/^2\d\d/.test(e.response?.status ?? "")) continue;
          const diag = e.response?.outcome?.issue?.[0]?.diagnostics ?? e.response?.status ?? "unknown";
          const key = diag.slice(0, 120);
          issues.set(key, (issues.get(key) ?? 0) + 1);
        }
        for (const [msg, count] of [...issues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
          console.log(`         × ${count}  ${msg}`);
        }
      }
    }
  }

  if (dryRun) return;

  // ── Summary ────────────────────────────────────────────────────────────────
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  const totalEntries = results.reduce((s, r) => s + r.resourceCount, 0);
  const successEntries = results.reduce((s, r) => s + r.successEntries, 0);

  console.log("\n" + "─".repeat(60));
  console.log(`Bundles uploaded : ${okCount}/${results.length}`);
  console.log(`Bundles failed   : ${failCount}`);
  console.log(`Entries written  : ${successEntries}/${totalEntries}`);

  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
