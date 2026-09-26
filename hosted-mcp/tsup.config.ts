import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const jobCore = fileURLToPath(new URL("../shared/job-core/src/index.ts", import.meta.url));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  bundle: true,
  splitting: false,
  noExternal: [/.*/],
  external: ["node:*"],
  esbuildOptions(options) {
    options.alias = { ...options.alias, "@jpm/job-core": jobCore };
  },
  outDir: "dist",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  define: { __PACKAGE_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.1.0") },
});
