import { describe, expect, it } from "vitest";
import { normalizeDiscoveredTools } from "../../catalog/src/index.js";
import type { ContextGateConfig } from "../../core/src/index.js";
import { MOCK_TOOLS_BY_SERVER } from "../../mcp-client/src/index.js";
import { loadPolicyDocument } from "../../policy/src/index.js";
import { DefaultSelectionEngine } from "./selection-engine.js";

const config: ContextGateConfig = {
  version: 1,
  servers: {
    jira: { transport: "mock", trust: "user_configured" },
    github: { transport: "mock", trust: "user_configured" },
    database: { transport: "mock", trust: "user_configured" },
  },
  policy: {},
  selection: {
    maxTools: 8,
    maxSchemaTokens: 8000,
    minRelevanceScore: 0.1,
  },
  audit: {
    path: ".contextgate/audit.jsonl",
    storePromptText: false,
    redactSecrets: true,
  },
  stateDir: ".contextgate",
};

describe("selection engine", () => {
  it("selects Jira and GitHub PR tools while excluding destructive database tools", async () => {
    const discovered = Object.entries(MOCK_TOOLS_BY_SERVER)
      .filter(([serverId]) => serverId in config.servers)
      .flatMap(([serverId, definitions]) => definitions.map((definition) => ({ serverId, definition })));
    const tools = normalizeDiscoveredTools(discovered, config.servers);
    const policy = await loadPolicyDocument(config);
    const engine = new DefaultSelectionEngine(tools, policy, config);

    const result = await engine.selectTools({
      prompt: "Read Jira ticket PROJ-123, inspect the repo, and open a PR with a fix",
      dryRun: true,
    });

    const selectedIds = result.selected.map((item) => item.tool.id);
    expect(selectedIds).toContain("jira.get_issue");
    expect(selectedIds).toContain("github.create_pull_request");
    expect(selectedIds).toContain("github.read_file");
    expect(selectedIds).not.toContain("database.drop_table");
    expect(result.selected.length).toBeLessThanOrEqual(8);
    expect(result.estimatedSchemaTokensSaved).toBeGreaterThan(0);
  });
});
