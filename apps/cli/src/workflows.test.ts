import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { SelectToolsResult } from "../../../packages/core/src/index.js";
import { assertPolicyTestThresholds, initProject, runPolicyCheckSuite } from "./workflows.js";

describe("CLI workflows", () => {
  it("fails policy checks based on configured CI thresholds", () => {
    const result: SelectToolsResult = {
      taskId: "task_123",
      promptHash: "hash",
      totalTools: 5,
      candidates: [],
      selected: [],
      rejected: [],
      hiddenCount: 1,
      blockedCount: 2,
      notRelevantCount: 0,
      estimatedSchemaTokensSaved: 10,
    };

    expect(() => assertPolicyTestThresholds(result, { failOnBlocked: true })).toThrow("blockedCount=2");
    expect(() => assertPolicyTestThresholds(result, { failOnHidden: true })).toThrow("hiddenCount=1");
    expect(() => assertPolicyTestThresholds(result, { failOnEmpty: true })).toThrow("no tools were selected");
    expect(() => assertPolicyTestThresholds(result, {})).not.toThrow();
  });

  it("runs a checked-in policy regression suite", async () => {
    const root = await mkdtemp(join(tmpdir(), "contextgate-suite-"));
    const configPath = join(root, "contextgate.yaml");
    const suitePath = join(root, "checks.json");

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

    await writeFile(
      suitePath,
      JSON.stringify(
        {
          version: 1,
          cases: [
            {
              name: "pr_flow",
              prompt: "Read Jira ticket PROJ-123 and open a PR with a fix",
              failOnEmpty: true,
            },
          ],
        },
        null,
        2,
      ),
    );

    const summary = await runPolicyCheckSuite({ suitePath, configPath });
    expect(summary.cases).toHaveLength(1);
    expect(summary.cases[0].passed).toBe(true);
  });

  it("creates team scaffold files during init", async () => {
    const root = await mkdtemp(join(tmpdir(), "contextgate-init-"));
    const cwd = process.cwd();
    process.chdir(root);
    try {
      const result = await initProject({ force: true, teamScaffold: true });
      expect(result.created).toContain("policies/checks/default.json");
      expect(result.created).toContain(".github/workflows/contextgate-policy-check.yml");
      expect(await readFile(join(root, "policies/checks/default.json"), "utf8")).toContain('"version": 1');
    } finally {
      process.chdir(cwd);
    }
  });
});
