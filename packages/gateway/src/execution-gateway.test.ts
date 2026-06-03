import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { LocalExecutionGateway } from "./execution-gateway.js";
import { checkServerHealth, expandTools, selectTools } from "./project.js";

describe("execution gateway", () => {
  it("allows selected tools and blocks guessed tools outside the task capability", async () => {
    const configPath = await writeTestProject();
    const { result } = await selectTools({
      configPath,
      prompt: "Read Jira ticket PROJ-123, inspect the repo, and open a PR with a fix",
    });
    expect(result.capabilityId).toBeTruthy();

    const gateway = new LocalExecutionGateway();
    const allowed = await gateway.callTool({
      configPath,
      taskId: result.taskId,
      capabilityId: result.capabilityId!,
      toolId: "jira.get_issue",
      arguments: {
        key: "PROJ-123",
      },
    });

    expect(allowed.decision).toBe("allowed");

    const blocked = await gateway.callTool({
      configPath,
      taskId: result.taskId,
      capabilityId: result.capabilityId!,
      toolId: "github.delete_repository",
      arguments: {
        repo: "ash/contextgate",
      },
    });

    expect(blocked.decision).toBe("blocked");
    expect(blocked.reasons).toContain("tool is not part of this task capability");
  });

  it("blocks calls with missing required arguments", async () => {
    const configPath = await writeTestProject();
    const { result } = await selectTools({
      configPath,
      prompt: "Read Jira ticket PROJ-123",
    });

    const gateway = new LocalExecutionGateway();
    const blocked = await gateway.callTool({
      configPath,
      taskId: result.taskId,
      capabilityId: result.capabilityId!,
      toolId: "jira.get_issue",
      arguments: {},
    });

    expect(blocked.decision).toBe("blocked");
    expect(blocked.reasons).toContain("missing required argument: key");
  });

  it("requires approval for ask-mode selected tools and executes after approval", async () => {
    const configPath = await writeTestProject();
    const { result } = await selectTools({
      configPath,
      prompt: "Merge GitHub pull request 42 in repo ash/contextgate",
      maxTools: 8,
    });
    expect(result.selected.map((item) => item.tool.id)).toContain("github.merge_pull_request");

    const gateway = new LocalExecutionGateway();
    const approvalRequired = await gateway.callTool({
      configPath,
      taskId: result.taskId,
      capabilityId: result.capabilityId!,
      toolId: "github.merge_pull_request",
      arguments: {
        repo: "ash/contextgate",
        number: 42,
      },
    });

    expect(approvalRequired.decision).toBe("approval_required");
    expect(approvalRequired.approvalId).toBeTruthy();

    const allowed = await gateway.callTool({
      configPath,
      taskId: result.taskId,
      capabilityId: result.capabilityId!,
      toolId: "github.merge_pull_request",
      arguments: {
        repo: "ash/contextgate",
        number: 42,
      },
      approval: {
        approved: true,
        approver: "test",
      },
    });

    expect(allowed.decision).toBe("allowed");
  });

  it("expands a task selection with additional relevant tools", async () => {
    const configPath = await writeTestProject();
    const { result } = await selectTools({
      configPath,
      prompt: "Read Jira ticket PROJ-123",
      maxTools: 1,
    });

    const expanded = await expandTools({
      configPath,
      taskId: result.taskId,
      reason: "Need to comment back on the issue",
      additionalTools: 2,
    });

    expect(expanded.selected.length).toBeGreaterThan(result.selected.length);
    expect(expanded.selected.map((item) => item.tool.id)).toContain("jira.add_comment");
  });

  it("reports server health for configured integrations", async () => {
    const configPath = await writeTestProject();
    const results = await checkServerHealth(configPath);

    expect(results).toEqual([
      { serverId: "github", transport: "mock", status: "ok", discoveredTools: 9 },
      { serverId: "jira", transport: "mock", status: "ok", discoveredTools: 4 },
    ]);
  });
});

async function writeTestProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "contextgate-test-"));
  const configPath = join(root, "contextgate.yaml");
  const policyPath = join(root, "policy.yaml");

  await writeFile(
    policyPath,
    [
      "version: 1",
      "defaults:",
      "  unknownToolMode: ask",
      "  selectedToolLimit: 8",
      "  maxSchemaTokens: 8000",
      "  capabilityTtlMinutes: 30",
      "servers:",
      "  jira:",
      "    defaultMode: allow",
      "  github:",
      "    defaultMode: allow",
      "tools:",
      "  github.merge_pull_request:",
      "    mode: ask",
      "    risk: write_safe",
      "  github.delete_repository:",
      "    mode: deny",
      "    risk: destructive",
      "selection:",
      "  maxTools: 8",
      "  minRelevanceScore: 0.10",
      "  riskPenalties:",
      "    read: 0",
      "    write_safe: 0.03",
      "    destructive: 0.35",
      "logging:",
      "  storePromptText: false",
      "  redactSecrets: true",
      "  auditPath: .contextgate/audit.jsonl",
      "",
    ].join("\n"),
  );

  await writeFile(
    configPath,
    [
      "version: 1",
      "servers:",
      "  jira:",
      "    transport: mock",
      "    trust: user_configured",
      "  github:",
      "    transport: mock",
      "    trust: user_configured",
      "policy:",
      "  file: policy.yaml",
      "selection:",
      "  maxTools: 8",
      "  maxSchemaTokens: 8000",
      "  minRelevanceScore: 0.10",
      "audit:",
      "  path: .contextgate/audit.jsonl",
      "  storePromptText: false",
      "  redactSecrets: true",
      "stateDir: .contextgate",
      "",
    ].join("\n"),
  );

  return configPath;
}
