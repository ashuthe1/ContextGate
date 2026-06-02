import type { ContextGateConfig, DiscoveredTool } from "../../core/src/index.js";
import { ConfigError } from "../../core/src/index.js";
import { MOCK_TOOLS_BY_SERVER } from "./mock-tools.js";

export interface McpConnectorManager {
  discoverTools(): Promise<DiscoveredTool[]>;
  callTool(serverId: string, toolName: string, args: unknown): Promise<unknown>;
}

export class LocalMcpConnectorManager implements McpConnectorManager {
  constructor(private readonly config: ContextGateConfig) {}

  async discoverTools(): Promise<DiscoveredTool[]> {
    const discovered: DiscoveredTool[] = [];

    for (const [serverId, server] of Object.entries(this.config.servers)) {
      if (server.transport !== "mock") {
        throw new ConfigError(
          `Server ${serverId} uses transport ${server.transport}; only mock transport is implemented in this milestone.`,
        );
      }

      const tools = MOCK_TOOLS_BY_SERVER[serverId] ?? [];
      for (const definition of tools) {
        discovered.push({ serverId, definition });
      }
    }

    return discovered;
  }

  async callTool(serverId: string, toolName: string, args: unknown): Promise<unknown> {
    const tool = MOCK_TOOLS_BY_SERVER[serverId]?.find((candidate) => candidate.name === toolName);
    if (!tool) {
      throw new ConfigError(`Mock tool ${serverId}.${toolName} does not exist.`);
    }

    return {
      content: [
        {
          type: "text",
          text: `Mock result for ${serverId}.${toolName}`,
        },
      ],
      structuredContent: {
        serverId,
        toolName,
        args,
      },
      isError: false,
    };
  }
}

export function createConnectorManager(config: ContextGateConfig): McpConnectorManager {
  return new LocalMcpConnectorManager(config);
}
