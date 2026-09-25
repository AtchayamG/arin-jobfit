export interface ToolExecutionRecord {
  tool: string;
  durationMs: number;
  isError: boolean;
  status?: string;
  hasText: boolean;
  hasStructuredContent: boolean;
  warnings?: string[];
  error?: { code?: string; message?: string };
}

export interface CliCheckResult {
  version: { pass: boolean; output: string };
  help: { pass: boolean; output: string };
  unknownArg: { pass: boolean; exitCode: number; output: string };
}

export interface EditionResult {
  edition: "nk" | "id";
  packageName: string;
  dataDirEnv: string;
  cli: CliCheckResult;
  toolList: {
    pass: boolean;
    count: number;
    namesMatch: boolean;
    orderStable: boolean;
    names: string[];
  };
  toolCoverage: Map<string, number>;
  invariants: {
    evidenceSubstring: boolean;
    doNotClaimGaps: boolean;
    discriminatoryExcluded: boolean;
    injectionNeutralized: boolean;
    rankingCorrect: boolean;
    salariesCorrect: boolean;
    duplicateDetected: boolean;
    l1Blocked: boolean;
    humanOnlyHandoff: boolean;
    noNetwork: boolean;
  };
  errorPaths: {
    missingArgsPass: boolean;
    unknownIdPass: boolean;
    oversizedPass: boolean;
  };
  persistence: {
    pass: boolean;
    details: string;
  };
  timings: {
    coldStartMs: number;
    warmStartMs: number;
    toolLatenciesMs: number[];
    p50Ms: number;
    maxMs: number;
  };
  defects: Array<{ id: string; severity: string; description: string; repro: string }>;
  knownLimitations: string[];
}
