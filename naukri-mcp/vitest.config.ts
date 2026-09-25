import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@jpm/job-core": fileURLToPath(new URL("../shared/job-core/src/index.ts", import.meta.url)),
    },
  },
  test: { testTimeout: 20_000, hookTimeout: 20_000 },
});
