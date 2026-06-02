import type { Command } from "commander";
import { indexTools } from "../workflows.js";

export function registerIndexCommand(program: Command): void {
  program
    .command("index")
    .description("Discover tools from configured MCP servers and write the local catalog.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .action(async (options: { config: string }) => {
      const tools = await indexTools(options.config);
      console.log(`Indexed ${tools.length} tools.`);
      const byServer = new Map<string, number>();
      for (const tool of tools) {
        byServer.set(tool.serverId, (byServer.get(tool.serverId) ?? 0) + 1);
      }
      for (const [serverId, count] of [...byServer.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        console.log(`  ${serverId}: ${count}`);
      }
    });
}
