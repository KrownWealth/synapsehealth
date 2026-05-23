import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, type SchemaUnion } from "@google/genai";
import { gatherEvidence } from "@/lib/priorAuth/evidence";
import { JustificationSchema } from "@/lib/priorAuth/schema";
import { FhirError } from "@/lib/fhirServer";
import type { EvidenceBundle } from "@/types/priorAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

const SYSTEM_INSTRUCTION = `You are a clinical writer drafting prior-authorization justifications for US payers.
You will be given a structured evidence bundle in JSON. Draft a justification under these rules:

1. EVERY citation MUST reference a resourceId that appears in the evidence bundle. Never invent ids.
2. If evidence required to justify the medication is missing from the bundle, add a specific line to missingEvidence (for example "No recent lipid panel on record"). Do not fabricate data.
3. Cite the most clinically load-bearing evidence: ICD-10/SNOMED diagnoses, recent labs with values and units, prior medication history with statuses (especially failed or discontinued therapies).
4. Write in third-person clinical prose. No markdown, no headers, no bullet lists. Be specific. Reference actual values from the bundle, not generalities.
5. diagnosisRationale, supportingEvidence, and priorTherapyRationale are each a single tight paragraph. narrative is a single cover-letter paragraph addressed to the payer that synthesises the three.`;

const RESPONSE_SCHEMA: SchemaUnion = {
  type: Type.OBJECT,
  properties: {
    diagnosisRationale: {
      type: Type.STRING,
      description:
        "Why the patient has the diagnosis that supports this medication.",
    },
    supportingEvidence: {
      type: Type.STRING,
      description:
        "Specific labs, observations, or notes that support medical necessity.",
    },
    priorTherapyRationale: {
      type: Type.STRING,
      description:
        "Step-therapy: what has been tried, what failed or was contraindicated. If none, state so explicitly.",
    },
    narrative: {
      type: Type.STRING,
      description:
        "Cover-letter paragraph for the payer that synthesises the rationales into a single submission narrative.",
    },
    citations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          resourceType: { type: Type.STRING },
          resourceId: { type: Type.STRING },
          detail: { type: Type.STRING },
        },
        required: ["resourceType", "resourceId", "detail"],
      },
    },
    missingEvidence: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    "diagnosisRationale",
    "supportingEvidence",
    "priorTherapyRationale",
    "narrative",
    "citations",
    "missingEvidence",
  ],
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server" },
      { status: 503 },
    );
  }

  let body: { patientId?: unknown; medicationRequestId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON" },
      { status: 400 },
    );
  }
  const { patientId, medicationRequestId } = body;
  if (
    typeof patientId !== "string" ||
    typeof medicationRequestId !== "string"
  ) {
    return NextResponse.json(
      { error: "patientId and medicationRequestId are both required strings" },
      { status: 400 },
    );
  }

  let evidence: EvidenceBundle;
  try {
    evidence = await gatherEvidence(patientId, medicationRequestId);
  } catch (err) {
    if (err instanceof FhirError) {
      return NextResponse.json(err.operationOutcome, { status: err.status });
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Evidence aggregation failed",
      },
      { status: 500 },
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const userPrompt = `Draft a prior-authorization justification for the medication and patient described in this evidence bundle:\n\n${JSON.stringify(evidence, null, 2)}`;

  const llmStart = Date.now();
  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "LLM call failed";
    const status = /api[_\s-]?key|unauthor|forbidden|401|403/i.test(message)
      ? 503
      : /rate|429|quota/i.test(message)
        ? 429
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
  const llmMs = Date.now() - llmStart;

  const raw = response.text ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Gemini returned non-JSON output", raw: raw.slice(0, 500) },
      { status: 502 },
    );
  }

  const validated = JustificationSchema.safeParse(parsed);
  if (!validated.success) {
    return NextResponse.json(
      {
        error: "Gemini response failed schema validation",
        issues: validated.error.issues,
        raw: parsed,
      },
      { status: 502 },
    );
  }

  // Citation grounding — every cited resourceId must be present in the evidence bundle.
  const validIds = new Set<string>([
    evidence.medication.id,
    ...evidence.activeConditions.map((c) => c.id),
    ...evidence.recentLabs.map((l) => l.id),
    ...evidence.priorMedications.map((m) => m.id),
    ...evidence.recentNotes.map((n) => n.id),
    ...(evidence.coverage ? [evidence.coverage.id] : []),
  ]);
  const fabricated = validated.data.citations.filter(
    (c) => !validIds.has(c.resourceId),
  );
  if (fabricated.length > 0) {
    return NextResponse.json(
      {
        error: "Gemini cited resource ids not present in the evidence bundle",
        fabricated,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    justification: validated.data,
    evidence,
    usage: response.usageMetadata ?? null,
    timings: { llmMs, evidenceMs: evidence.timings.totalMs },
  });
}
