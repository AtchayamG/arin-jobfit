/**
 * Store error class and error codes per Doc 16 §3D.
 *
 * Messages never include row content or PII.
 */

export type StoreErrorCode =
  "INVALID_ID" | "LIMIT_EXCEEDED" | "CONFIRMATION_INVALID" | "CORRUPT_ROW" | "INVALID_DATA_DIR";

export class StoreError extends Error {
  readonly code: StoreErrorCode;

  constructor(code: StoreErrorCode, message: string) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}
