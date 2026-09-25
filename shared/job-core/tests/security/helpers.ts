export interface ToolResponse<T = Record<string, unknown>> {
  status: string;
  data: T;
  warnings?: Array<{ code: string; message?: string }>;
  error?: { code: string; message?: string };
  human_action_required?: { reason: string; official_url: string };
  provenance?: unknown[];
  subjectId?: string;
}

export function asEnvelope<T = Record<string, unknown>>(res: {
  structuredContent?: unknown;
}): ToolResponse<T> {
  return res.structuredContent as ToolResponse<T>;
}
