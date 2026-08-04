import { createHash } from "node:crypto";
import { canonicalizeD5 } from "@simwar/shared-contracts";

export function d5Digest(value: unknown): string {
  return createHash("sha256").update(canonicalizeD5(value), "utf8").digest("hex");
}
