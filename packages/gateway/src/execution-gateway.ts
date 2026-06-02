import type { JsonObject, Tool } from "../../core/src/index.js";
import { createConnectorManager } from "../../mcp-client/src/index.js";
import { DefaultPolicyEngine } from "../../policy/src/index.js";
import { createId } from "../../core/src/index.js";
import { audit, loadProject } from "./project.js";
import { CapabilityStore } from "./capability-store.js";
import { validateArguments } from "./argument-validator.js";
import { sanitizeToolResult } from "./result-sanitizer.js";

export interface ToolCallInput {
  configPath?: string;
  taskId: string;
  capabilityId: string;
  toolId: string;
  arguments: JsonObject;
  approval?: {
    approved: boolean;
    approver?: string;
    reason?: string;
  };
}

export interface ToolCallResult {
  decision: "allowed" | "approval_required" | "blocked";
  taskId: string;
  capabilityId: string;
  toolId: string;
  approvalId?: string;
  reasons: string[];
  result?: unknown;
  errors?: string[];
}

export interface ExecutionGateway {
  callTool(input: ToolCallInput): Promise<ToolCallResult>;
}

export class LocalExecutionGateway implements ExecutionGateway {
  async callTool(input: ToolCallInput): Promise<ToolCallResult> {
    const project = await loadProject(input.configPath);
    const capabilityStore = new CapabilityStore(project.stateDir);
    const task = await capabilityStore.loadTaskSelection(input.taskId);
    const capability = await capabilityStore.loadCapability(input.capabilityId);
    const tool = findTool(task.selected.map((item) => item.tool), input.toolId);
    const auditLog = audit(project);

    if (capability.taskId !== input.taskId) {
      return this.block(input, ["capability does not belong to task"]);
    }

    if (new Date(capability.expiresAt).getTime() < Date.now()) {
      return this.block(input, ["capability expired"]);
    }

    if (!capability.toolIds.includes(input.toolId)) {
      await auditLog.write({
        timestamp: new Date().toISOString(),
        type: "tool_blocked",
        taskId: input.taskId,
        toolId: input.toolId,
        decision: "blocked",
        reasons: ["tool is not part of this task capability"],
      });
      return this.block(input, ["tool is not part of this task capability"]);
    }

    if (!tool) {
      await auditLog.write({
        timestamp: new Date().toISOString(),
        type: "tool_blocked",
        taskId: input.taskId,
        toolId: input.toolId,
        decision: "blocked",
        reasons: ["tool was not found in task selection"],
      });
      return this.block(input, ["tool was not found in task selection"]);
    }

    const validation = validateArguments(tool.inputSchema, input.arguments);
    if (!validation.valid || !validation.arguments) {
      await auditLog.write({
        timestamp: new Date().toISOString(),
        type: "tool_blocked",
        taskId: input.taskId,
        toolId: input.toolId,
        decision: "blocked",
        reasons: validation.errors,
      });
      return this.block(input, validation.errors);
    }

    const policyEngine = new DefaultPolicyEngine(project.policy);
    const executionDecision = policyEngine.evaluateExecution({
      tool,
      arguments: validation.arguments,
      taskId: input.taskId,
      capabilityId: input.capabilityId,
    });

    if (executionDecision.decision === "block") {
      await auditLog.write({
        timestamp: new Date().toISOString(),
        type: "tool_blocked",
        taskId: input.taskId,
        toolId: input.toolId,
        decision: "blocked",
        reasons: executionDecision.reasons,
      });
      return this.block(input, executionDecision.reasons);
    }

    if (executionDecision.decision === "require_approval" && input.approval?.approved !== true) {
      const approvalId = createId("approval");
      await auditLog.write({
        timestamp: new Date().toISOString(),
        type: "approval_requested",
        taskId: input.taskId,
        toolId: input.toolId,
        decision: "approval_required",
        reasons: executionDecision.reasons,
        data: {
          approvalId,
          arguments: validation.arguments,
        },
      });

      return {
        decision: "approval_required",
        taskId: input.taskId,
        capabilityId: input.capabilityId,
        toolId: input.toolId,
        approvalId,
        reasons: executionDecision.reasons,
      };
    }

    if (executionDecision.decision === "require_approval") {
      await auditLog.write({
        timestamp: new Date().toISOString(),
        type: "approval_granted",
        taskId: input.taskId,
        toolId: input.toolId,
        decision: "allowed",
        reasons: executionDecision.reasons,
        data: {
          approver: input.approval?.approver ?? "local-user",
          reason: input.approval?.reason ?? "",
        },
      });
    }

    await auditLog.write({
      timestamp: new Date().toISOString(),
      type: "tool_call_started",
      taskId: input.taskId,
      toolId: input.toolId,
      decision: "allowed",
      reasons: executionDecision.reasons,
      data: {
        arguments: validation.arguments,
      },
    });

    const startedAt = Date.now();
    const connectorManager = createConnectorManager(project.config);
    const rawResult = await connectorManager.callTool(tool.serverId, tool.name, validation.arguments);
    const result = sanitizeToolResult(rawResult, { redactSecrets: project.config.audit.redactSecrets });

    await auditLog.write({
      timestamp: new Date().toISOString(),
      type: "tool_call_finished",
      taskId: input.taskId,
      toolId: input.toolId,
      decision: "allowed",
      reasons: executionDecision.reasons,
      data: {
        latencyMs: Date.now() - startedAt,
      },
    });

    return {
      decision: "allowed",
      taskId: input.taskId,
      capabilityId: input.capabilityId,
      toolId: input.toolId,
      reasons: executionDecision.reasons,
      result,
    };
  }

  private block(input: ToolCallInput, reasons: string[]): ToolCallResult {
    return {
      decision: "blocked",
      taskId: input.taskId,
      capabilityId: input.capabilityId,
      toolId: input.toolId,
      reasons,
      errors: reasons,
    };
  }
}

function findTool(tools: Tool[], toolId: string): Tool | undefined {
  return tools.find((tool) => tool.id === toolId);
}
