import { z } from 'zod';

export const CitationSchema = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  detail: z.string().min(1),
});

export const JustificationSchema = z.object({
  diagnosisRationale: z.string().min(1),
  supportingEvidence: z.string().min(1),
  priorTherapyRationale: z.string().min(1),
  narrative: z.string().min(1),
  citations: z.array(CitationSchema),
  missingEvidence: z.array(z.string()),
});

export type ZJustification = z.infer<typeof JustificationSchema>;
