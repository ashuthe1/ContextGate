import type { Command } from "commander";
import { formatSelectionResult, selectTools } from "../workflows.js";

export function registerSelectCommand(program: Command): void {
  program
    .command("select")
    .description("Select task-relevant, policy-approved tools for a prompt.")
    .argument("<prompt>", "User task prompt.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .option("--max-tools <count>", "Override max selected tools.")
    .action(async (prompt: string, options: { config: string; maxTools?: string }) => {
      const maxTools = options.maxTools ? Number(options.maxTools) : undefined;
      const { result, indexed } = await selectTools({
        prompt,
        configPath: options.config,
        maxTools,
      });

      console.log(formatSelectionResult(result, { indexed }));
    });
}

export function registerPolicyTestCommand(program: Command): void {
  const policy = program.command("policy").description("Policy utilities.");
  policy
    .command("test")
    .description("Dry-run tool selection without creating a task capability.")
    .argument("<prompt>", "User task prompt.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .option("--max-tools <count>", "Override max selected tools.")
    .action(async (prompt: string, options: { config: string; maxTools?: string }) => {
      const maxTools = options.maxTools ? Number(options.maxTools) : undefined;
      const { result, indexed } = await selectTools({
        prompt,
        configPath: options.config,
        maxTools,
        dryRun: true,
      });

      console.log(formatSelectionResult(result, { indexed }));
    });

  program
    .command("policy-test")
    .description("Alias for `policy test`.")
    .argument("<prompt>", "User task prompt.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .option("--max-tools <count>", "Override max selected tools.")
    .action(async (prompt: string, options: { config: string; maxTools?: string }) => {
      const maxTools = options.maxTools ? Number(options.maxTools) : undefined;
      const { result, indexed } = await selectTools({
        prompt,
        configPath: options.config,
        maxTools,
        dryRun: true,
      });

      console.log(formatSelectionResult(result, { indexed }));
    });
}
