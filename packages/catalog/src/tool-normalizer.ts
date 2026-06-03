import type { DiscoveredTool, ServerConfig, Tool } from "../../core/src/index.js";
import { buildToolId } from "../../core/src/index.js";
import { hashToolDefinition } from "./tool-hasher.js";
import { assessToolTrust } from "./tool-trust.js";

export function normalizeDiscoveredTools(
  discoveredTools: DiscoveredTool[],
  servers: Record<string, ServerConfig>,
  existingTools: Tool[] = [],
): Tool[] {
  const now = new Date().toISOString();
  const existingById = new Map(existingTools.map((tool) => [tool.id, tool]));

  return discoveredTools.map(({ serverId, definition }) => {
    const id = buildToolId(serverId, definition.name);
    const existing = existingById.get(id);
    const trustLevel = servers[serverId]?.trust ?? "unknown";
    const trust = assessToolTrust({
      serverTrust: trustLevel,
      name: definition.name,
      title: definition.title,
      description: definition.description,
      annotations: definition.annotations,
    });

    return {
      id,
      serverId,
      name: definition.name,
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      annotations: definition.annotations,
      trustLevel,
      riskClass: existing?.riskClass ?? "unknown",
      hash: hashToolDefinition(definition),
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastSeenAt: now,
      unavailable: false,
      trustScore: trust.trustScore,
      trustWarnings: trust.trustWarnings,
    };
  });
}
