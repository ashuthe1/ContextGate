import { describe, expect, it, vi } from "vitest";
import type { SelectToolsResult } from "../../core/src/index.js";
import { ContextGate } from "./client.js";

describe("ContextGate SDK", () => {
  it("calls the daemon selection API with SDK mode fields", async () => {
    const selection: SelectToolsResult = {
      taskId: "task_123",
      capabilityId: "cap_123",
      promptHash: "hash",
      totalTools: 3,
      candidates: [],
      selected: [],
      rejected: [],
      hiddenCount: 0,
      blockedCount: 0,
      notRelevantCount: 0,
      estimatedSchemaTokensSaved: 42,
    };

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) =>
      new Response(JSON.stringify(selection), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = new ContextGate({ baseUrl: "http://127.0.0.1:3737/", fetch: fetchMock as typeof fetch });
    const result = await client.selectTools({
      prompt: "Read PROJ-123 and open a PR",
      userId: "user_1",
      projectId: "demo",
      maxTools: 6,
    });

    expect(result).toEqual(selection);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3737/v1/tool-selection",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          prompt: "Read PROJ-123 and open a PR",
          userId: "user_1",
          projectId: "demo",
          maxTools: 6,
        }),
      }),
    );
  });

  it("returns approval_required tool-call responses without throwing", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          decision: "approval_required",
          taskId: "task_123",
          capabilityId: "cap_123",
          toolId: "github.merge_pull_request",
          approvalId: "approval_123",
          reasons: ["approval required by policy"],
        }),
        {
          status: 202,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const client = new ContextGate({ baseUrl: "http://127.0.0.1:3737", fetch: fetchMock as typeof fetch });
    const result = await client.callTool({
      taskId: "task_123",
      capabilityId: "cap_123",
      toolId: "github.merge_pull_request",
      arguments: { repo: "ash/contextgate", number: 42 },
    });

    expect(result.decision).toBe("approval_required");
  });

  it("supports server health and task expansion endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ serverId: "filesystem", transport: "stdio", status: "ok", discoveredTools: 3 }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            taskId: "task_123",
            capabilityId: "cap_456",
            promptText: "Read docs",
            promptHash: "hash",
            totalTools: 3,
            candidates: [],
            selected: [],
            rejected: [],
            hiddenCount: 0,
            blockedCount: 0,
            notRelevantCount: 0,
            estimatedSchemaTokensSaved: 12,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    const client = new ContextGate({ baseUrl: "http://127.0.0.1:3737", fetch: fetchMock as typeof fetch });
    const health = await client.serverHealth();
    const expanded = await client.expandTools("task_123", "Need filesystem write access", 2);

    expect(health[0].serverId).toBe("filesystem");
    expect(expanded.capabilityId).toBe("cap_456");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3737/v1/tasks/task_123/expand",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          reason: "Need filesystem write access",
          additionalTools: 2,
        }),
      }),
    );
  });
});
