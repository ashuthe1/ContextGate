import type { Command } from "commander";
import { initProject } from "../workflows.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a starter ContextGate config.")
    .option("--team-scaffold", "Also create shared policy, bundle, and CI scaffold files.")
    .option("--force", "Overwrite existing files.")
    .action(async (options: { force?: boolean; teamScaffold?: boolean }) => {
      const result = await initProject(options);
      for (const file of result.created) {
        console.log(`created ${file}`);
      }
      for (const file of result.skipped) {
        console.log(`skipped ${file} (already exists)`);
      }
    });
}
