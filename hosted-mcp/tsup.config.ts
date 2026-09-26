import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const jobCore = fileURLToPath(new URL("../shared/job-core/src/index.ts", import.meta.url));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  bundle: true,
  noExternal: [/.*/],
  external: ["node:*"],
  esbuildPlugins: [
    {
      name: "stub-unused-core-modules",
      setup(build) {
        build.onResolve({ filter: /(store|mcp)\/index/ }, (args) => ({
          path: args.path,
          namespace: "stub-unused",
        }));
        build.onLoad({ filter: /.*/, namespace: "stub-unused" }, () => ({
          contents: "export default {};",
          loader: "js",
        }));
      },
    },
  ],
  esbuildOptions(options) {
    options.alias = { ...options.alias, "@jpm/job-core": jobCore };
  },
  outDir: "dist",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  define: { __PACKAGE_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.1.0") },
});
