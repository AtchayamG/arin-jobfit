/**
 * Opaque keyset cursor encoding and decoding per Doc 16 §3D.
 *
 * Encodes {ingested_at, job_id} to base64url. Validates schema and ID on decode.
 */

import { z } from "zod";
import { jobIdSchema } from "../schemas/domain.js";
import { StoreError } from "./error.js";

const cursorPayloadSchema = z.strictObject({
  ingested_at: z.iso.datetime(),
  job_id: jobIdSchema,
});

export interface DecodedCursor {
  readonly ingested_at: string;
  readonly job_id: string;
}

export function encodeCursor(ingestedAt: string, jobId: string): string {
  const payload = JSON.stringify({ ingested_at: ingestedAt, job_id: jobId });
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): DecodedCursor {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    const result = cursorPayloadSchema.safeParse(parsed);
    if (!result.success) {
      throw new StoreError("INVALID_ID", "Invalid cursor payload structure");
    }
    return result.data;
  } catch (err) {
    if (err instanceof StoreError) {
      throw err;
    }
    throw new StoreError("INVALID_ID", "Malformed keyset cursor");
  }
}
