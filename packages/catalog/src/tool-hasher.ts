import { createHash } from "node:crypto";
import type { McpToolDefinition } from "../../core/src/index.js";
import { stableStringify } from "./stable-stringify.js";

export function hashToolDefinition(definition: McpToolDefinition): string {
  return createHash("sha256").update(stableStringify(definition)).digest("hex");
}
