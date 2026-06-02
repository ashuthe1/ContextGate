import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Command } from "commander";
import { LocalExecutionGateway } from "../../../../packages/gateway/src/index.js";
import type { JsonObject } from "../../../../packages/core/src/index.js";

export function registerCallCommand(program: Command): void {
  program
    .command("call")
    .description("Call a selected tool through the policy-enforcing gateway.")
    .argument("<task-id>", "Task id returned by contextgate select.")
    .argument("<capability-id>", "Capability id returned by contextgate select.")
    .argument("<tool-id>", "Tool id to call, such as jira.get_issue.")
    .argument("<arguments-json>", "Tool arguments as a JSON object.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .option("-y, --yes", "Automatically approve once if the tool requires approval.")
    .option("--no-prompt", "Do not prompt for approval; return approval_required instead.")
    .action(
      async (
        taskId: string,
        capabilityId: string,
        toolId: string,
        argumentsJson: string,
        options: { config: string; yes?: boolean; prompt?: boolean },
      ) => {
        const args = parseArguments(argumentsJson);
        const gateway = new LocalExecutionGateway();
        let result = await gateway.callTool({
          configPath: options.config,
          taskId,
          capabilityId,
          toolId,
          arguments: args,
        });

        if (result.decision === "approval_required" && options.yes) {
          result = await gateway.callTool({
            configPath: options.config,
            taskId,
            capabilityId,
            toolId,
            arguments: args,
            approval: {
              approved: true,
              approver: "cli",
              reason: "approved with --yes",
            },
          });
        } else if (result.decision === "approval_required" && options.prompt !== false) {
          const approved = await promptForApproval(result.toolId, result.reasons);
          if (approved) {
            result = await gateway.callTool({
              configPath: options.config,
              taskId,
              capabilityId,
              toolId,
              arguments: args,
              approval: {
                approved: true,
                approver: "cli",
                reason: "approved interactively",
              },
            });
          }
        }

        console.log(JSON.stringify(result, null, 2));
      },
    );
}

function parseArguments(raw: string): JsonObject {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("arguments-json must parse to a JSON object.");
  }

  return parsed;
}

async function promptForApproval(toolId: string, reasons: string[]): Promise<boolean> {
  const readline = createInterface({ input, output });
  try {
    console.error(`Approval required for ${toolId}`);
    for (const reason of reasons) {
      console.error(`  - ${reason}`);
    }
    const answer = await readline.question("Approve once? [y/N] ");
    return answer.trim().toLowerCase() === "y";
  } finally {
    readline.close();
  }
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
