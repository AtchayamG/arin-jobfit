import { readFile, writeFile } from "node:fs/promises";

const bundle = new URL("../dist/index.js", import.meta.url);
const source = await readFile(bundle, "utf8");
const corrected = source.replaceAll('from "sqlite"', 'from "node:sqlite"');
if (corrected === source) throw new Error("Expected bundled node:sqlite import was not found");
await writeFile(bundle, corrected);
