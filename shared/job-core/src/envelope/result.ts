import type { Envelope, Warning } from "../schemas/index.js";

const MAX_TEXT_BYTES = 64 * 1024;
const utf8 = new TextEncoder();
const truncatedWarning: Warning = {
  code: "OUTPUT_TRUNCATED",
  message: "Text fallback exceeded 64 KB; structured content has the full data.",
};

export interface CallToolResultLike {
  structuredContent: Envelope<unknown>;
  content: [{ type: "text"; text: string }];
  isError: boolean;
}

export function toCallToolResult<T>(envelope: Envelope<T>): CallToolResultLike {
  let text = JSON.stringify(envelope);
  if (utf8.encode(text).byteLength > MAX_TEXT_BYTES) {
    envelope = { ...envelope, warnings: [...envelope.warnings, truncatedWarning] };
    text = JSON.stringify({ ...envelope, data: null });
    if (utf8.encode(text).byteLength > MAX_TEXT_BYTES) {
      text = JSON.stringify({ ...envelope, data: null, warnings: [truncatedWarning] });
    }
  }
  return {
    structuredContent: envelope,
    content: [{ type: "text", text }],
    isError: envelope.status === "error",
  };
}
