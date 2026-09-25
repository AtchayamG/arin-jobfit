import type { HumanAction, Provenance, ProviderId, Warning, ErrorCode } from "../schemas/index.js";
import type { Policy } from "../policy/index.js";
import type { Store } from "../store/index.js";

export interface ProductConfig {
  serverName: "naukri-mcp" | "indeed-mcp";
  serverVersion: string;
  provider: ProviderId;
  policy: Policy;
  hostAllowlist: string[];
  store: Store;
  now?: () => Date;
  logger?: (line: string) => void;
}

export interface DomainResult {
  data: unknown;
  warnings?: Warning[];
  provenance?: Provenance[];
  humanAction?: HumanAction;
  subjectId?: string;
  confirmationRequired?: boolean;
}

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly subjectId?: string,
  ) {
    super(code);
  }
}
