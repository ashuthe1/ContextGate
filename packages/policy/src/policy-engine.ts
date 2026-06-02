import type {
  ExecutionDecision,
  ExecutionInput,
  ExposureDecision,
  ExposureInput,
  PolicyDocument,
  PolicyMode,
  RiskClass,
  Tool,
} from "../../core/src/index.js";
import { classifyRisk } from "./risk-classifier.js";

export interface PolicyEngine {
  evaluateExposure(input: ExposureInput): ExposureDecision;
  evaluateExecution(input: ExecutionInput): ExecutionDecision;
}

export class DefaultPolicyEngine implements PolicyEngine {
  constructor(private readonly policy: PolicyDocument) {}

  evaluateExposure(input: ExposureInput): ExposureDecision {
    const { mode, riskClass, policyRuleId } = this.resolveToolPolicy(input.tool);
    const reasons = [...input.reasons, `risk:${riskClass}`, `mode:${mode}`];

    if (input.score < this.policy.selection.minRelevanceScore) {
      return {
        decision: "not_relevant",
        mode,
        riskClass,
        reasons: [...reasons, `score below minimum ${this.policy.selection.minRelevanceScore}`],
        policyRuleId,
      };
    }

    if (mode === "hide") {
      return {
        decision: "hidden",
        mode,
        riskClass,
        reasons: [...reasons, "hidden by policy"],
        policyRuleId,
      };
    }

    if (mode === "deny") {
      return {
        decision: "blocked",
        mode,
        riskClass,
        reasons: [...reasons, "denied by policy"],
        policyRuleId,
      };
    }

    if (mode === "ask" || mode === "shadow") {
      return {
        decision: "selected_requires_approval",
        mode,
        riskClass,
        reasons: [...reasons, "execution will require approval"],
        policyRuleId,
      };
    }

    return {
      decision: "selected",
      mode,
      riskClass,
      reasons,
      policyRuleId,
    };
  }

  evaluateExecution(input: ExecutionInput): ExecutionDecision {
    const { mode, riskClass, policyRuleId } = this.resolveToolPolicy(input.tool);
    const reasons = [`risk:${riskClass}`, `mode:${mode}`];

    if (this.matchesEmergencyDeny(input.tool, input.arguments)) {
      return {
        decision: "block",
        mode,
        riskClass,
        reasons: [...reasons, "blocked by emergency deny pattern"],
        policyRuleId: "emergency.deny",
      };
    }

    if (mode === "hide" || mode === "deny") {
      return {
        decision: "block",
        mode,
        riskClass,
        reasons: [...reasons, "tool cannot execute under policy"],
        policyRuleId,
      };
    }

    if (mode === "ask" || mode === "shadow") {
      return {
        decision: "require_approval",
        mode,
        riskClass,
        reasons: [...reasons, "approval required by policy"],
        policyRuleId,
      };
    }

    return {
      decision: "allow",
      mode,
      riskClass,
      reasons,
      policyRuleId,
    };
  }

  resolveToolPolicy(tool: Tool): { mode: PolicyMode; riskClass: RiskClass; policyRuleId?: string } {
    const explicitTool = this.policy.tools[tool.id];
    const riskClass = explicitTool?.risk ?? classifyRisk(tool);

    if (explicitTool?.mode) {
      return {
        mode: explicitTool.mode,
        riskClass,
        policyRuleId: `tools.${tool.id}`,
      };
    }

    const serverPolicy = this.policy.servers[tool.serverId];
    if (serverPolicy?.defaultMode) {
      return {
        mode: serverPolicy.defaultMode,
        riskClass,
        policyRuleId: `servers.${tool.serverId}`,
      };
    }

    return {
      mode: defaultModeForRisk(riskClass, this.policy.defaults.unknownToolMode),
      riskClass,
      policyRuleId: `risk.${riskClass}`,
    };
  }

  riskPenalty(riskClass: RiskClass): number {
    return this.policy.selection.riskPenalties[riskClass] ?? 0;
  }

  private matchesEmergencyDeny(tool: Tool, args: unknown): boolean {
    if (tool.id !== "shell.run_command") {
      return false;
    }

    const command = isRecord(args) && typeof args.command === "string" ? args.command.toLowerCase() : "";
    return command.includes("rm -rf") || command.includes("curl") || command.includes("sudo");
  }
}

export function defaultModeForRisk(riskClass: RiskClass, unknownMode: PolicyMode): PolicyMode {
  switch (riskClass) {
    case "read":
      return "allow";
    case "write_safe":
      return "allow";
    case "write_external":
    case "destructive":
    case "privileged_infra":
    case "monetary":
    case "credential_access":
      return "ask";
    case "unknown":
      return unknownMode;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
