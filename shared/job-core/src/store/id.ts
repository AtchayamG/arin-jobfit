/**
 * ID validation helpers for Job and Profile entities.
 *
 * Enforces T-07 input sanitization and throws StoreError('INVALID_ID') on malformed IDs.
 */

import { jobIdSchema, profileIdSchema } from "../schemas/domain.js";
import { StoreError } from "./error.js";

export function validateJobId(id: string): void {
  if (typeof id !== "string" || !jobIdSchema.safeParse(id).success) {
    throw new StoreError("INVALID_ID", "Invalid job ID format");
  }
}

export function validateProfileId(id: string): void {
  if (typeof id !== "string" || !profileIdSchema.safeParse(id).success) {
    throw new StoreError("INVALID_ID", "Invalid profile ID format");
  }
}
