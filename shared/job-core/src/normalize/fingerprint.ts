import { createHash } from "node:crypto";
import type { JobInput } from "../schemas/index.js";

export function fingerprintJob(input: JobInput): string {
  const canonical = (text: string): string => text.normalize("NFKC").toLowerCase().trim();
  const material = [
    canonical(input.title),
    canonical(input.company ?? ""),
    canonical(input.location ?? ""),
    canonical(input.description).replace(/\s+/g, " "),
  ].join("|");
  return `sha256:${createHash("sha256").update(material, "utf8").digest("hex")}`;
}
