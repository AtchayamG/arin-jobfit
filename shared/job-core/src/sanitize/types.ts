/**
 * Types for untrusted-text sanitization, prompt injection detection, and URL validation.
 *
 * Implements security primitives per Doc 16 §3B, Doc 17 §3, and Threat Model T-01/T-05/T-06.
 */

export interface SanitizeOptions {
  readonly field?: string;
  readonly maxLength?: number;
}

export interface SanitizeWarning {
  readonly code: "CONTENT_SANITIZED";
  readonly message: string;
  readonly field?: string;
}

export interface SanitizeSuccess {
  readonly ok: true;
  readonly text: string;
  readonly changed: boolean;
  readonly warnings: readonly SanitizeWarning[];
}

export interface SanitizeError {
  readonly ok: false;
  readonly code: "INPUT_TOO_LARGE";
  readonly field?: string;
}

export type SanitizeResult = SanitizeSuccess | SanitizeError;

export interface InjectionDetectionResult {
  readonly suspected: boolean;
  readonly signals: readonly string[];
}

export interface ValidUrlResult {
  readonly ok: true;
  readonly url: string;
  readonly isOfficial: boolean;
}

export interface InvalidUrlResult {
  readonly ok: false;
  readonly code: "UNSAFE_URL";
  readonly reason: string;
}

export type ValidateUrlResult = ValidUrlResult | InvalidUrlResult;
