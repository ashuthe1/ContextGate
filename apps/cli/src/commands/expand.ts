import type { Command } from "commander";
import { expandTools, formatSelectionResult } from "../workflows.js";

export function registerExpandCommand(program: Command): void {
  program
    .command("expand")
    .description("Expand an existing task selection with additional tools for a follow-up reason.")
    .argument("<taskId>", "Existing task id.")
    .argument("<reason>", "Why more tools are needed.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .option("--additional-tools <count>", "Maximum number of extra tools to add.", "3")
    .action(
      async (taskId: string, reason: string, options: { config: string; additionalTools: string }) => {
        const result = await expandTools({
          taskId,
          reason,
          configPath: options.config,
          additionalTools: Number(options.additionalTools),
        });

        console.log(formatSelectionResult(result));
      },
    );
}
