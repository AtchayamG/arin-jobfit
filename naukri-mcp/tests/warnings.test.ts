import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

describe("SQLite warning filter", () => {
  it("suppresses SQLite ExperimentalWarning and preserves DeprecationWarning on stderr", () => {
    const warningFilter = fileURLToPath(new URL("../src/warnings.ts", import.meta.url));
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx/esm",
        "--import",
        pathToFileURL(warningFilter).href,
        "--input-type=module",
        "-e",
        'process.emitWarning("SQLite is an experimental feature", { type: "ExperimentalWarning" }); process.emitWarning("preserved warning", { type: "DeprecationWarning" });',
      ],
      { encoding: "utf8", timeout: 5_000 },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("SQLite is an experimental feature");
    expect(result.stderr).toContain("DeprecationWarning: preserved warning");
  });
});
