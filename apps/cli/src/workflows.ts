import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  type CatalogDiff,
  defaultConfigText,
  type PolicyBundle,
  type PolicyCheckCase,
  type PolicyCheckSuite,
  type ServerHealth,
  type SelectToolsResult,
} from "../../../packages/core/src/index.js";
import { ConfigError } from "../../../packages/core/src/index.js";
import {
  exportPolicyBundle,
  importPolicyBundle,
  readPolicyBundle,
  verifyPolicyBundle,
} from "../../../packages/policy/src/index.js";
import { selectTools as runSelection } from "../../../packages/gateway/src/index.js";
export {
  checkServerHealth,
  expandTools,
  indexTools,
  loadProject,
  selectTools,
  type LoadedProject,
} from "../../../packages/gateway/src/index.js";

export async function initProject(options: {
  force?: boolean;
  teamScaffold?: boolean;
}): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  await writeIfAllowed("contextgate.yaml", defaultConfigText(), options.force, created, skipped);
  if (options.teamScaffold) {
    await writeIfAllowed("policies/checks/default.json", defaultPolicyCheckSuiteText(), options.force, created, skipped);
    await writeIfAllowed("policies/README.md", defaultPoliciesReadmeText(), options.force, created, skipped);
    await writeIfAllowed(
      ".github/workflows/contextgate-policy-check.yml",
      defaultGitHubWorkflowText(),
      options.force,
      created,
      skipped,
    );
    await writeIfAllowed("policies/bundles/.gitkeep", "", options.force, created, skipped);
  }

  return { created, skipped };
}

export function formatSelectionResult(result: SelectToolsResult, options: { indexed?: boolean } = {}): string {
  const lines: string[] = [];
  if (options.indexed) {
    lines.push("Catalog was missing; indexed configured MCP servers first.");
    lines.push("");
  }

  lines.push(`Task: ${result.taskId}`);
  if (result.capabilityId) {
    lines.push(`Capability: ${result.capabilityId}`);
  }
  lines.push(`Catalog tools: ${result.totalTools}`);
  lines.push(`Candidate tools: ${result.candidates.length}`);
  lines.push(`Selected tools: ${result.selected.length}`);
  lines.push(`Hidden by policy: ${result.hiddenCount}`);
  lines.push(`Blocked by policy: ${result.blockedCount}`);
  lines.push(`Not relevant: ${result.notRelevantCount}`);
  lines.push(`Estimated schema tokens saved: ${result.estimatedSchemaTokensSaved}`);
  lines.push("");

  lines.push("Selected:");
  if (result.selected.length === 0) {
    lines.push("  none");
  } else {
    for (const item of result.selected) {
      const marker = item.requiresApproval ? "ask" : item.mode;
      lines.push(
        `  ${pad(item.tool.id, 32)} ${pad(marker, 5)} score=${item.score.toFixed(2)} ${shortReasons(item.reasons)}`,
      );
    }
  }

  const interestingRejected = result.rejected
    .filter((item) => item.decision === "hidden" || item.decision === "blocked")
    .slice(0, 12);

  lines.push("");
  lines.push("Hidden or blocked:");
  if (interestingRejected.length === 0) {
    lines.push("  none");
  } else {
    for (const item of interestingRejected) {
      lines.push(`  ${pad(item.tool.id, 32)} ${pad(item.decision, 7)} ${shortReasons(item.reasons)}`);
    }
  }

  return lines.join("\n");
}

export function formatCatalogIndexResult(tools: number, diff: CatalogDiff): string {
  const lines = [`Indexed ${tools} tools.`];
  lines.push(`Added: ${diff.added.length}`);
  lines.push(`Changed: ${diff.changed.length}`);
  lines.push(`Removed: ${diff.removed.length}`);
  lines.push(`Unchanged: ${diff.unchanged}`);
  return lines.join("\n");
}

export function formatHealthResult(results: ServerHealth[]): string {
  const lines = [`Servers checked: ${results.length}`];
  for (const result of results) {
    if (result.status === "ok") {
      lines.push(
        `  ${pad(result.serverId, 16)} ${pad(result.transport, 6)} ok    tools=${result.discoveredTools ?? 0}`,
      );
    } else {
      lines.push(`  ${pad(result.serverId, 16)} ${pad(result.transport, 6)} error ${result.error ?? "unknown error"}`);
    }
  }
  return lines.join("\n");
}

export function formatPolicyTestJson(result: SelectToolsResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function assertPolicyTestThresholds(
  result: SelectToolsResult,
  options: { failOnBlocked?: boolean; failOnHidden?: boolean; failOnEmpty?: boolean },
): void {
  if (options.failOnBlocked && result.blockedCount > 0) {
    throw new Error(`Policy test failed: blockedCount=${result.blockedCount}`);
  }
  if (options.failOnHidden && result.hiddenCount > 0) {
    throw new Error(`Policy test failed: hiddenCount=${result.hiddenCount}`);
  }
  if (options.failOnEmpty && result.selected.length === 0) {
    throw new Error("Policy test failed: no tools were selected");
  }
}

export async function runPolicyCheckSuite(input: {
  suitePath: string;
  configPath?: string;
}): Promise<{
  version: 1;
  cases: Array<{
    name: string;
    passed: boolean;
    error?: string;
    result: SelectToolsResult;
  }>;
}> {
  const suite = await loadPolicyCheckSuite(input.suitePath);
  const cases = [];

  for (const testCase of suite.cases) {
    const { result } = await runSelection({
      prompt: testCase.prompt,
      configPath: input.configPath,
      maxTools: testCase.maxTools,
      dryRun: true,
    });

    let passed = true;
    let error: string | undefined;
    try {
      assertPolicyTestThresholds(result, testCase);
    } catch (failure) {
      passed = false;
      error = failure instanceof Error ? failure.message : String(failure);
    }

    cases.push({
      name: testCase.name,
      passed,
      error,
      result,
    });
  }

  return {
    version: 1,
    cases,
  };
}

export async function createPolicyBundle(input: {
  configPath?: string;
  bundleName: string;
  outputPath: string;
}): Promise<PolicyBundle> {
  return exportPolicyBundle(input);
}

export async function installPolicyBundle(input: {
  bundlePath: string;
  outputPath?: string;
  configPath?: string;
}): Promise<{ bundle: PolicyBundle; installedPath: string }> {
  return importPolicyBundle(input);
}

export async function verifyBundleFile(bundlePath: string): Promise<{
  bundle: PolicyBundle;
  valid: boolean;
  expected: string;
  actual: string;
}> {
  const bundle = await readPolicyBundle(bundlePath);
  return {
    bundle,
    ...verifyPolicyBundle(bundle),
  };
}

async function loadPolicyCheckSuite(path: string): Promise<PolicyCheckSuite> {
  const raw = await readFile(resolve(path), "utf8");
  const parsed = JSON.parse(raw) as PolicyCheckSuite;
  if (parsed.version !== 1 || !Array.isArray(parsed.cases)) {
    throw new ConfigError(`Invalid policy check suite at ${path}.`);
  }

  for (const testCase of parsed.cases) {
    if (!isPolicyCheckCase(testCase)) {
      throw new ConfigError(`Invalid policy check case in ${path}.`);
    }
  }

  return parsed;
}

function isPolicyCheckCase(value: unknown): value is PolicyCheckCase {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "prompt" in value &&
    typeof value.prompt === "string"
  );
}

function defaultPolicyCheckSuiteText(): string {
  return `${JSON.stringify(
    {
      version: 1,
      cases: [
        {
          name: "jira_to_github_pr",
          prompt: "Read Jira ticket PROJ-123, inspect the repo, and open a PR with a fix",
          failOnEmpty: true,
        },
        {
          name: "dangerous_delete_blocked",
          prompt: "Delete the old GitHub repository and drop the stale database table",
          failOnBlocked: true,
        },
      ],
    },
    null,
    2,
  )}\n`;
}

function defaultPoliciesReadmeText(): string {
  return [
    "# Team Policy Assets",
    "",
    "- `checks/default.json` contains CI regression prompts for `contextgate policy test-file`.",
    "- `bundles/` is the recommended location for exported shared policy bundles.",
    "- Commit these files so every repo member and CI job evaluates the same policy expectations.",
    "",
  ].join("\n");
}

function defaultGitHubWorkflowText(): string {
  return [
    "name: ContextGate Policy Check",
    "",
    "on:",
    "  pull_request:",
    "  push:",
    "    branches:",
    "      - main",
    "",
    "jobs:",
    "  policy-check:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: '22'",
    "          cache: npm",
    "      - run: npm ci",
    "      - run: npm run cli -- index --config contextgate.yaml",
    "      - run: npm run cli -- policy test-file policies/checks/default.json --config contextgate.yaml --json",
    "",
  ].join("\n");
}

async function writeIfAllowed(
  path: string,
  content: string,
  force: boolean | undefined,
  created: string[],
  skipped: string[],
): Promise<void> {
  if (!force && (await exists(path))) {
    skipped.push(path);
    return;
  }

  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(path, content);
  created.push(path);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function pad(value: string, length: number): string {
  return value.padEnd(length, " ");
}

function shortReasons(reasons: string[]): string {
  const compact = reasons.filter((reason) => !reason.startsWith("token:")).slice(0, 3);
  return compact.length > 0 ? `# ${compact.join(", ")}` : "";
}
