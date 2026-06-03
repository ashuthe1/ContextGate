import { describe, expect, it } from "vitest";
import type { Tool } from "../../core/src/index.js";
import { diffCatalogTools } from "./catalog-store.js";

describe("catalog diff", () => {
  it("reports added, removed, changed, and unchanged tools", () => {
    const previous = [tool("jira.get_issue", "hash_a"), tool("github.read_file", "hash_b")];
    const next = [tool("jira.get_issue", "hash_changed"), tool("github.create_pull_request", "hash_c")];

    expect(diffCatalogTools(previous, next)).toEqual({
      added: ["github.create_pull_request"],
      removed: ["github.read_file"],
      changed: ["jira.get_issue"],
      unchanged: 0,
    });
  });
});

function tool(id: string, hash: string): Tool {
  const [serverId, name] = id.split(".");
  return {
    id,
    serverId,
    name,
    inputSchema: { type: "object" },
    trustLevel: "user_configured",
    riskClass: "read",
    hash,
    firstSeenAt: "2026-06-03T00:00:00.000Z",
    lastSeenAt: "2026-06-03T00:00:00.000Z",
    unavailable: false,
  };
}
