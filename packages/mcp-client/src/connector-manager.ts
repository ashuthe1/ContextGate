import type { ContextGateConfig, DiscoveredTool } from "../../core/src/index.js";
import { ConfigError } from "../../core/src/index.js";
import { MOCK_TOOLS_BY_SERVER } from "./mock-tools.js";
import { StdioMcpClient } from "./stdio-client.js";

export interface McpConnectorManager {
  discoverTools(): Promise<DiscoveredTool[]>;
  callTool(serverId: string, toolName: string, args: unknown): Promise<unknown>;
  discoverServerTools(serverId: string): Promise<DiscoveredTool[]>;
}

export class LocalMcpConnectorManager implements McpConnectorManager {
  constructor(private readonly config: ContextGateConfig) {}

  async discoverTools(): Promise<DiscoveredTool[]> {
    const discovered: DiscoveredTool[] = [];

    for (const serverId of Object.keys(this.config.servers)) {
      discovered.push(...(await this.discoverServerTools(serverId)));
    }

    return discovered;
  }

  async discoverServerTools(serverId: string): Promise<DiscoveredTool[]> {
    const server = this.config.servers[serverId];
    if (!server) {
      throw new ConfigError(`Server ${serverId} is not configured.`);
    }

    if (server.transport === "mock") {
      const tools = MOCK_TOOLS_BY_SERVER[serverId] ?? [];
      return tools.map((definition) => ({ serverId, definition }));
    }

    if (server.transport === "stdio") {
      const client = new StdioMcpClient(serverId, server);
      try {
        await client.connect();
        return (await client.listTools()).map((definition) => ({ serverId, definition }));
      } finally {
        await client.close();
      }
    }

    throw new ConfigError(
      `Server ${serverId} uses transport ${server.transport}; only mock and stdio transports are implemented.`,
    );
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
