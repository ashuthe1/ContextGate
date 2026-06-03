import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { handleRequest } from "./server.js";

describe("daemon", () => {
  it("serves health checks without opening a socket", async () => {
    const request = Readable.from([]) as IncomingMessage;
    request.method = "GET";
    request.url = "/health";

    const response = new MockResponse();
    await handleRequest(request, response as unknown as ServerResponse, {});

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: "ok" });
  });

  it("serves server health for configured mock integrations", async () => {
    const configPath = await writeTestProject();
    const request = Readable.from([]) as IncomingMessage;
    request.method = "GET";
    request.url = "/v1/server-health";

    const response = new MockResponse();
    await handleRequest(request, response as unknown as ServerResponse, { configPath });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual([
      { serverId: "github", transport: "mock", status: "ok", discoveredTools: 9 },
      { serverId: "jira", transport: "mock", status: "ok", discoveredTools: 4 },
    ]);
  });

  it("serves the local web UI assets", async () => {
    const request = Readable.from([]) as IncomingMessage;
    request.method = "GET";
    request.url = "/ui";

    const response = new MockResponse();
    await handleRequest(request, response as unknown as ServerResponse, {});

    expect(response.status).toBe(200);
    expect(response.headers?.["content-type"]).toContain("text/html");
    expect(response.body).toContain("ContextGate Console");
  });

  it("serves catalog, tasks, approvals, and timeline views", async () => {
    const configPath = await writeUiStateProject();

    const catalogResponse = new MockResponse();
    const catalogRequest = Readable.from([]) as IncomingMessage;
    catalogRequest.method = "GET";
    catalogRequest.url = "/v1/catalog";
    await handleRequest(catalogRequest, catalogResponse as unknown as ServerResponse, { configPath });
    expect(catalogResponse.status).toBe(200);
    expect(JSON.parse(catalogResponse.body).tools[0].id).toBe("jira.get_issue");

    const tasksResponse = new MockResponse();
    const tasksRequest = Readable.from([]) as IncomingMessage;
    tasksRequest.method = "GET";
    tasksRequest.url = "/v1/tasks";
    await handleRequest(tasksRequest, tasksResponse as unknown as ServerResponse, { configPath });
    expect(tasksResponse.status).toBe(200);
    expect(JSON.parse(tasksResponse.body)[0].taskId).toBe("task_123");

    const approvalsResponse = new MockResponse();
    const approvalsRequest = Readable.from([]) as IncomingMessage;
    approvalsRequest.method = "GET";
    approvalsRequest.url = "/v1/approvals";
    await handleRequest(approvalsRequest, approvalsResponse as unknown as ServerResponse, { configPath });
    expect(approvalsResponse.status).toBe(200);
    expect(JSON.parse(approvalsResponse.body)[0].toolId).toBe("github.merge_pull_request");

    const timelineResponse = new MockResponse();
    const timelineRequest = Readable.from([]) as IncomingMessage;
    timelineRequest.method = "GET";
    timelineRequest.url = "/v1/tasks/task_123/timeline";
    await handleRequest(timelineRequest, timelineResponse as unknown as ServerResponse, { configPath });
    expect(timelineResponse.status).toBe(200);
    expect(JSON.parse(timelineResponse.body)).toHaveLength(2);
  });

  it("loads and saves the configured policy file", async () => {
    const configPath = await writeUiStateProject();

    const getRequest = Readable.from([]) as IncomingMessage;
    getRequest.method = "GET";
    getRequest.url = "/v1/policy";
    const getResponse = new MockResponse();
    await handleRequest(getRequest, getResponse as unknown as ServerResponse, { configPath });
    expect(getResponse.status).toBe(200);
    expect(JSON.parse(getResponse.body).editable).toBe(true);

    const updatedPolicy = ["version: 1", "defaults:", "  unknownToolMode: deny", ""].join("\n");
    const putRequest = Readable.from([JSON.stringify({ text: updatedPolicy })]) as IncomingMessage;
    putRequest.method = "PUT";
    putRequest.url = "/v1/policy";
    const putResponse = new MockResponse();
    await handleRequest(putRequest, putResponse as unknown as ServerResponse, { configPath });
    expect(putResponse.status).toBe(200);
    expect(JSON.parse(putResponse.body).text).toContain("unknownToolMode: deny");
  });

  it("approves and denies pending approvals through daemon routes", async () => {
    const approveConfigPath = await writeUiStateProject();
    const approveRequest = Readable.from([JSON.stringify({ approver: "tester", reason: "looks safe" })]) as IncomingMessage;
    approveRequest.method = "POST";
    approveRequest.url = "/v1/approvals/approval_1/approve";
    const approveResponse = new MockResponse();
    await handleRequest(approveRequest, approveResponse as unknown as ServerResponse, { configPath: approveConfigPath });
    expect(approveResponse.status).toBe(200);
    expect(JSON.parse(approveResponse.body).decision).toBe("allowed");

    const denyConfigPath = await writeUiStateProject();
    const denyRequest = Readable.from([JSON.stringify({ approver: "tester", reason: "not safe" })]) as IncomingMessage;
    denyRequest.method = "POST";
    denyRequest.url = "/v1/approvals/approval_1/deny";
    const denyResponse = new MockResponse();
    await handleRequest(denyRequest, denyResponse as unknown as ServerResponse, { configPath: denyConfigPath });
    expect(denyResponse.status).toBe(200);
    expect(JSON.parse(denyResponse.body).denied).toBe(true);
  });
});

class MockResponse {
  status?: number;
  headers?: Record<string, string>;
  body = "";

  writeHead(status: number, headers: Record<string, string>): void {
    this.status = status;
    this.headers = headers;
  }

  end(body: string): void {
    this.body += body;
  }
}

async function writeTestProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "contextgate-daemon-test-"));
  const configPath = join(root, "contextgate.yaml");

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

async function writeUiStateProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "contextgate-ui-test-"));
  const configPath = join(root, "contextgate.yaml");
  const stateDir = join(root, ".contextgate");
  await mkdir(join(stateDir, "tasks"), { recursive: true });
  await mkdir(join(stateDir, "capabilities"), { recursive: true });
  const policyPath = join(root, "policy.yaml");

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
      "selection:",
      "  maxTools: 8",
      "  minRelevanceScore: 0.10",
      "logging:",
      "  storePromptText: false",
      "  redactSecrets: true",
      "  auditPath: .contextgate/audit.jsonl",
      "",
    ].join("\n"),
  );

  await writeFile(
    join(stateDir, "catalog.json"),
    `${JSON.stringify({
      version: 1,
      updatedAt: "2026-06-03T00:00:00.000Z",
      tools: [
        {
          id: "jira.get_issue",
          serverId: "jira",
          name: "get_issue",
          description: "Fetch issue",
          inputSchema: { type: "object" },
          trustLevel: "user_configured",
          riskClass: "read",
          hash: "hash",
          firstSeenAt: "2026-06-03T00:00:00.000Z",
          lastSeenAt: "2026-06-03T00:00:00.000Z",
          unavailable: false,
        },
      ],
    })}\n`,
  );

  await writeFile(
    join(stateDir, "tasks", "task_123.json"),
    `${JSON.stringify({
      taskId: "task_123",
      capabilityId: "cap_123",
      promptText: "Read Jira ticket PROJ-123",
      promptHash: "hash",
      totalTools: 1,
      candidates: [],
      selected: [
        {
          tool: {
            id: "github.merge_pull_request",
            serverId: "github",
            name: "merge_pull_request",
            description: "Merge PR",
            inputSchema: { type: "object" },
            trustLevel: "user_configured",
            riskClass: "write_safe",
            hash: "hash",
            firstSeenAt: "2026-06-03T00:00:00.000Z",
            lastSeenAt: "2026-06-03T00:00:00.000Z",
            unavailable: false,
          },
          score: 0.9,
          mode: "ask",
          riskClass: "write_safe",
          requiresApproval: true,
          reasons: ["workflow_hint"],
        },
      ],
      rejected: [],
      hiddenCount: 0,
      blockedCount: 0,
      notRelevantCount: 0,
      estimatedSchemaTokensSaved: 10,
    })}\n`,
  );

  await writeFile(
    join(stateDir, "audit.jsonl"),
    [
      JSON.stringify({
        timestamp: "2026-06-03T00:00:00.000Z",
        type: "approval_requested",
        taskId: "task_123",
        toolId: "github.merge_pull_request",
        decision: "approval_required",
        reasons: ["approval required by policy"],
        data: { approvalId: "approval_1", arguments: { repo: "ash/contextgate", number: 42 } },
      }),
      JSON.stringify({
        timestamp: "2026-06-03T00:01:00.000Z",
        type: "task_started",
        taskId: "task_123",
        decision: "selected",
        reasons: ["selected:1"],
      }),
      "",
    ].join("\n"),
  );

  await writeFile(
    join(stateDir, "capabilities", "cap_123.json"),
    `${JSON.stringify({
      id: "cap_123",
      taskId: "task_123",
      toolIds: ["github.merge_pull_request"],
      expiresAt: "2099-06-03T00:00:00.000Z",
      callLimits: { maxCallsTotal: 10, maxCallsPerTool: 10 },
      resourceConstraints: {},
    })}\n`,
  );

  return configPath;
}
