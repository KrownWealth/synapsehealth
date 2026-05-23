/**
 * diagnose.ts
 * Run this first to see what resource types are actually in your files.
 *
 * Usage: npx tsx diagnose.ts
 */

import fs from "fs";
import path from "path";

const INPUT_DIR = __dirname;

function isPatientFile(f: string) {
  return (
    f.endsWith(".json") &&
    !f.startsWith("hospital") &&
    !f.startsWith("practitioner") &&
    !f.startsWith("package")
  );
}

const files = fs.readdirSync(INPUT_DIR).filter(isPatientFile);

console.log(`\nScanning first 3 files...\n`);

// ── 1. Show all resource types in first 3 files ───────────────────────────
for (const file of files.slice(0, 3)) {
  const raw = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, file), "utf8"));
  const entries = raw.entry ?? [];
  const types = entries
    .map((e: any) => e.resource?.resourceType)
    .filter(Boolean);
  const counts: Record<string, number> = {};
  for (const t of types) counts[t] = (counts[t] ?? 0) + 1;

  console.log(`FILE: ${file}`);
  console.log("  Resource types found:");
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`    ${k.padEnd(25)} × ${v}`));
  console.log();
}

// ── 2. Across all files — which types appear at least once? ───────────────
console.log(`\nAll resource types across all ${files.length} files:\n`);
const globalCounts: Record<string, number> = {};
let filesWithCoverage = 0;
let filesWithMedicationRequest = 0;
let filesWithServiceRequest = 0;

for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, file), "utf8"));
  const entries = raw.entry ?? [];
  const types = new Set(
    entries.map((e: any) => e.resource?.resourceType).filter(Boolean),
  );

  for (const t of types)
    globalCounts[t as string] = (globalCounts[t as string] ?? 0) + 1;

  if (types.has("Coverage")) filesWithCoverage++;
  if (types.has("MedicationRequest")) filesWithMedicationRequest++;
  if (types.has("ServiceRequest")) filesWithServiceRequest++;
}

Object.entries(globalCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) =>
    console.log(`  ${k.padEnd(30)} in ${v}/${files.length} files`),
  );

console.log(`\nSummary:`);
console.log(`  Files with Coverage          : ${filesWithCoverage}`);
console.log(`  Files with MedicationRequest : ${filesWithMedicationRequest}`);
console.log(`  Files with ServiceRequest    : ${filesWithServiceRequest}`);
