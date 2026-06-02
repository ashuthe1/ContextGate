import type { JsonObject, Tool } from "../../core/src/index.js";

export function schemaPropertyNames(schema: JsonObject): string[] {
  const properties = schema.properties;
  if (!isRecord(properties)) {
    return [];
  }

  return Object.keys(properties);
}

export function estimateToolSchemaTokens(tool: Tool): number {
  const raw = JSON.stringify({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
  });

  return Math.ceil(raw.length / 4);
}

export function summarizeToolForSearch(tool: Tool): string {
  const props = schemaPropertyNames(tool.inputSchema).join(" ");
  return [
    tool.serverId,
    tool.name,
    tool.title ?? "",
    tool.description ?? "",
    props,
    tool.riskClass,
  ]
    .filter(Boolean)
    .join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
