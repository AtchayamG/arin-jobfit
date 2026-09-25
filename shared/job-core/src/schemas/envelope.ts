import { z } from "zod";
import {
  capabilityLevelSchema,
  providerIdSchema,
  provenanceSchema,
  toolErrorSchema,
  warningSchema,
} from "./common.js";

export const humanActionSchema = z.strictObject({
  reason: z.string(),
  actions: z.array(z.string()),
  official_url: z
    .url({ protocol: /^https$/ })
    .meta({ format: "uri", pattern: "^https://" })
    .nullable(),
});

export const envelopeMetaSchema = z.strictObject({
  tool: z.string(),
  request_id: z.uuid(),
  server: z.enum(["naukri-mcp", "indeed-mcp"]),
  server_version: z.string().regex(/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/),
  policy_snapshot_date: z.iso.date(),
  scoring_version: z.string().optional(),
});

export const envelopeSchema = <T extends z.ZodType>(dataSchema: T) =>
  z
    .strictObject({
      contract_version: z.literal("1.0.0"),
      status: z.enum(["ok", "partial", "error"]),
      provider: providerIdSchema,
      capability_mode: capabilityLevelSchema,
      source_provenance: z.array(provenanceSchema),
      data: dataSchema.nullable(),
      warnings: z.array(warningSchema),
      human_action_required: humanActionSchema.nullable(),
      error: toolErrorSchema.nullable(),
      meta: envelopeMetaSchema,
    })
    .refine(
      (value) =>
        (value.status === "error") === (value.error !== null) &&
        (value.status !== "error" || ("data" in value && value.data === null)),
      { message: "Error status requires an error and null data; non-error status forbids error" },
    );

export type Envelope<T> = z.infer<ReturnType<typeof envelopeSchema<z.ZodType<T>>>>;
export type HumanAction = z.infer<typeof humanActionSchema>;
