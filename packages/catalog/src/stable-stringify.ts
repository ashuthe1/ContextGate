import type { JsonValue } from "../../core/src/index.js";

export function stableStringify(value: JsonValue | unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (typeof value === "object" && value !== null) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }

    return sorted;
  }

  return value;
}
