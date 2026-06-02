import type { ContextGateConfig, DiscoveredTool } from "../../core/src/index.js";
import { ConfigError } from "../../core/src/index.js";
import { MOCK_TOOLS_BY_SERVER } from "./mock-tools.js";
import { StdioMcpClient } from "./stdio-client.js";

export interface McpConnectorManager {
  discoverTools(): Promise<DiscoveredTool[]>;
  callTool(serverId: string, toolName: string, args: unknown): Promise<unknown>;
}

export class LocalMcpConnectorManager implements McpConnectorManager {
  constructor(private readonly config: ContextGateConfig) {}

  async discoverTools(): Promise<DiscoveredTool[]> {
    const discovered: DiscoveredTool[] = [];

    for (const [serverId, server] of Object.entries(this.config.servers)) {
      if (server.transport === "mock") {
        const tools = MOCK_TOOLS_BY_SERVER[serverId] ?? [];
        for (const definition of tools) {
          discovered.push({ serverId, definition });
        }
        continue;
      }

      if (server.transport === "stdio") {
        const client = new StdioMcpClient(serverId, server);
        try {
          await client.connect();
          for (const definition of await client.listTools()) {
            discovered.push({ serverId, definition });
          }
        } finally {
          await client.close();
        }
        continue;
      }

      throw new ConfigError(
        `Server ${serverId} uses transport ${server.transport}; only mock and stdio transports are implemented.`,
      );
    }

    return discovered;
  }

  async callTool(serverId: string, toolName: string, args: unknown): Promise<unknown> {
    const server = this.config.servers[serverId];
    if (!server) {
      throw new ConfigError(`Server ${serverId} is not configured.`);
    }

    if (server.transport === "mock") {
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

    if (server.transport === "stdio") {
      const client = new StdioMcpClient(serverId, server);
      try {
        await client.connect();
        return await client.callTool(toolName, args);
      } finally {
        await client.close();
      }
    }

    throw new ConfigError(`Server ${serverId} uses unsupported transport ${server.transport}.`);
  }
}

export function createConnectorManager(config: ContextGateConfig): McpConnectorManager {
  return new LocalMcpConnectorManager(config);
}
