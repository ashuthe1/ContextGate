import { CapabilityStore, LocalExecutionGateway, audit, loadProject } from "../../../packages/gateway/src/index.js";
import type { ToolCallResult } from "../../../packages/gateway/src/index.js";
import { ConfigError } from "../../../packages/core/src/index.js";
import { listPendingApprovals } from "./state-view.js";

export async function approveRequest(input: {
  approvalId: string;
  configPath?: string;
  approver?: string;
  reason?: string;
}): Promise<ToolCallResult> {
  const project = await loadProject(input.configPath);
  const pending = await listPendingApprovals(project.auditPath);
  const match = pending.find((item) => item.approvalId === input.approvalId);
  if (!match || !match.arguments) {
    throw new ConfigError(`Approval request ${input.approvalId} was not found or is no longer pending.`);
  }

  const store = new CapabilityStore(project.stateDir);
  const selection = await store.loadTaskSelection(match.taskId);
  if (!selection.capabilityId) {
    throw new ConfigError(`Task ${match.taskId} has no active capability for approval replay.`);
  }

  const gateway = new LocalExecutionGateway();
  return gateway.callTool({
    configPath: input.configPath,
    taskId: match.taskId,
    capabilityId: selection.capabilityId,
    toolId: match.toolId,
    arguments: match.arguments,
    approval: {
      approved: true,
      approver: input.approver ?? "ui-user",
      reason: input.reason,
    },
  });
}

export async function denyRequest(input: {
  approvalId: string;
  configPath?: string;
  approver?: string;
  reason?: string;
}): Promise<{ denied: true; approvalId: string }> {
  const project = await loadProject(input.configPath);
  const pending = await listPendingApprovals(project.auditPath);
  const match = pending.find((item) => item.approvalId === input.approvalId);
  if (!match) {
    throw new ConfigError(`Approval request ${input.approvalId} was not found or is no longer pending.`);
  }

  await audit(project).write({
    timestamp: new Date().toISOString(),
    type: "approval_denied",
    taskId: match.taskId,
    toolId: match.toolId,
    decision: "blocked",
    reasons: [input.reason ?? "denied in UI"],
    data: {
      approvalId: input.approvalId,
      approver: input.approver ?? "ui-user",
    },
  });

  return {
    denied: true,
    approvalId: input.approvalId,
  };
}
