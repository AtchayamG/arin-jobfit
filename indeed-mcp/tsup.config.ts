import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "tsup";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  bundle: true,
  splitting: false,
  noExternal: [/.*/],
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    "process.env.PACKAGE_VERSION": JSON.stringify(packageJson.version),
  },
  esbuildOptions(options) {
    options.target = "node22";
    options.alias = {
      "@jpm/job-core": path.resolve(import.meta.dirname, "../shared/job-core/src/index.ts"),
    };
  },
  async onSuccess() {
    const distPath = path.resolve(import.meta.dirname, "dist/index.js");
    if (fs.existsSync(distPath)) {
      const code = fs.readFileSync(distPath, "utf-8");
      const patched = code.replace(/from\s*["']sqlite["']/g, 'from "node:sqlite"');
      fs.writeFileSync(distPath, patched, "utf-8");
    }
  },
});
