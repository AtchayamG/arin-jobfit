import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SQL Safety Scanner", () => {
  const storeSrcDir = path.resolve(__dirname, "../../src/store");

  it("ensures all calls to prepare() and exec() use static strings without interpolation or concatenation", () => {
    const files = fs.readdirSync(storeSrcDir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThanOrEqual(10);

    const violations: string[] = [];

    for (const file of files) {
      const filePath = path.join(storeSrcDir, file);
      const content = fs.readFileSync(filePath, "utf8");

      // Match .prepare(...) and .exec(...)
      const callRegex = /(?:\.prepare|\.exec)\s*\(([\s\S]*?)\);/g;
      let match: RegExpExecArray | null;

      while ((match = callRegex.exec(content)) !== null) {
        const arg = match[1]?.trim() ?? "";

        // Violation 1: Template string interpolation ${...}
        if (arg.includes("${")) {
          violations.push(`${file}: Template string interpolation found in SQL call: ${arg}`);
        }

        // Violation 2: String concatenation using '+'
        // Check if '+' is used outside of string literals
        // Simple check: any '+' token in the argument
        if (arg.includes("+")) {
          violations.push(`${file}: String concatenation '+' found in SQL call: ${arg}`);
        }
      }
    }

    expect(violations, `SQL safety violations found:\n${violations.join("\n")}`).toEqual([]);
  });
});
