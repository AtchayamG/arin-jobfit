import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@jpm/job-core": path.resolve(import.meta.dirname, "../shared/job-core/src/index.ts"),
    },
  },
});
