import { describe, expect, it } from "vitest";
import type { PolicyDocument, Tool } from "../../core/src/index.js";
import { DefaultPolicyEngine } from "./policy-engine.js";
import { classifyRisk } from "./risk-classifier.js";

const baseTool: Tool = {
  id: "github.delete_repository",
  serverId: "github",
  name: "delete_repository",
  title: "Delete repository",
  description: "Permanently delete a GitHub repository.",
  inputSchema: { type: "object", properties: {} },
  trustLevel: "user_configured",
  riskClass: "unknown",
  hash: "hash",
  firstSeenAt: "2026-06-03T00:00:00.000Z",
  lastSeenAt: "2026-06-03T00:00:00.000Z",
};

describe("risk classifier", () => {
  it("classifies destructive tools from names and descriptions", () => {
    expect(classifyRisk(baseTool)).toBe("destructive");
  });

  it("does not treat ordinary issue keys as credentials", () => {
    expect(
      classifyRisk({
        ...baseTool,
        id: "jira.get_issue",
        serverId: "jira",
        name: "get_issue",
        title: "Get Jira issue",
        description: "Fetch a Jira issue by key.",
      }),
    ).toBe("read");
  });
});

describe("policy engine", () => {
  it("explicit tool deny wins over server allow", () => {
    const policy: PolicyDocument = {
      version: 1,
      defaults: {
        unknownToolMode: "ask",
        selectedToolLimit: 12,
        maxSchemaTokens: 8000,
        capabilityTtlMinutes: 30,
      },
      servers: {
        github: { defaultMode: "allow" },
      },
      tools: {
        "github.delete_repository": { mode: "deny", risk: "destructive" },
      },
      selection: {
        maxTools: 12,
        minRelevanceScore: 0.1,
        riskPenalties: {},
      },
      logging: {
        storePromptText: false,
        redactSecrets: true,
        auditPath: ".contextgate/audit.jsonl",
      },
    };

    const engine = new DefaultPolicyEngine(policy);
    const exposure = engine.evaluateExposure({
      tool: baseTool,
      score: 0.9,
      reasons: ["test"],
      prompt: "delete repository",
    });

    expect(exposure.decision).toBe("blocked");
    expect(exposure.policyRuleId).toBe("tools.github.delete_repository");
  });
});
