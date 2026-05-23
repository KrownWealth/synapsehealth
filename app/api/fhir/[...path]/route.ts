import { NextRequest, NextResponse } from "next/server";
import { fhirServerFetch, FhirError } from "@/lib/fhirServer";

const ALLOWED_RESOURCES = new Set([
  "Patient",
  "Coverage",
  "Observation",
  "Condition",
  "MedicationRequest",
  "AllergyIntolerance",
  "Immunization",
  "Encounter",
  "Procedure",
  "DiagnosticReport",
  "DocumentReference",
  "Communication",
  "Claim",
  "Organization",
  "Practitioner",
  "Location",
]);

function logFhirAccess(method: string, path: string, status: number) {
  // console.log(JSON.stringify({
  //   type: 'fhir_access',
  //   timestamp: new Date().toISOString(),
  //   source: 'bff',
  //   method, path, status,
  // }));
}

async function handle(
  req: NextRequest,
  ctx: { params: { path: string[] } },
  method: string,
) {
  const [resource, ...rest] = ctx.params.path ?? [];

  if (!resource || !ALLOWED_RESOURCES.has(resource)) {
    logFhirAccess(method, `/${resource ?? ""}`, 403);
    return NextResponse.json(
      { error: "Resource not allowed", allowed: Array.from(ALLOWED_RESOURCES) },
      { status: 403 },
    );
  }

  const search = req.nextUrl.search;
  const subPath = `/${resource}${rest.length ? "/" + rest.join("/") : ""}${search}`;
  const body =
    method === "GET" || method === "DELETE" ? undefined : await req.text();

  try {
    const data = await fhirServerFetch<unknown>(subPath, { method, body });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof FhirError) {
      return NextResponse.json(err.operationOutcome, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unknown FHIR error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = (req: NextRequest, ctx: { params: { path: string[] } }) =>
  handle(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: { params: { path: string[] } }) =>
  handle(req, ctx, "POST");
export const PUT = (req: NextRequest, ctx: { params: { path: string[] } }) =>
  handle(req, ctx, "PUT");

export const dynamic = "force-dynamic";
