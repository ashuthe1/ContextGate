import type { Command } from "commander";
import { checkServerHealth, formatHealthResult } from "../workflows.js";

export function registerHealthCommand(program: Command): void {
  program
    .command("health")
    .description("Check configured MCP server connectivity and tool discovery.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .action(async (options: { config: string }) => {
      const results = await checkServerHealth(options.config);
      console.log(formatHealthResult(results));
    });
}
