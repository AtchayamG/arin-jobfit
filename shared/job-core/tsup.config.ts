import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { compilerOptions: { types: ["node"] } },
  clean: true,
  sourcemap: true,
});
