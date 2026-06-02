#!/usr/bin/env node
import { Command } from "commander";
import { registerIndexCommand } from "./commands/index.js";
import { registerInitCommand } from "./commands/init.js";
import { registerPolicyTestCommand, registerSelectCommand } from "./commands/select.js";

const program = new Command();

program
  .name("contextgate")
  .description("Policy-aware MCP tool router.")
  .version("0.1.0")
  .showHelpAfterError();

registerInitCommand(program);
registerIndexCommand(program);
registerSelectCommand(program);
registerPolicyTestCommand(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
});
