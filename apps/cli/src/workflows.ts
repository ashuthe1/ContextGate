import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  defaultConfigText,
  CatalogError,
  loadConfig,
  type ContextGateConfig,
  type PolicyDocument,
  type SelectToolsResult,
  type Tool,
} from "../../../packages/core/src/index.js";
import { CatalogStore, normalizeDiscoveredTools } from "../../../packages/catalog/src/index.js";
import { createConnectorManager } from "../../../packages/mcp-client/src/index.js";
import {
  DefaultPolicyEngine,
  loadPolicyDocument,
} from "../../../packages/policy/src/index.js";
import { DefaultSelectionEngine } from "../../../packages/retrieval/src/index.js";
import { JsonlAuditLog } from "../../../packages/audit/src/index.js";

export interface LoadedProject {
  configPath: string;
  config: ContextGateConfig;
  policy: PolicyDocument;
  stateDir: string;
  auditPath: string;
}

export async function initProject(options: { force?: boolean }): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  await writeIfAllowed("contextgate.yaml", defaultConfigText(), options.force, created, skipped);

  return { created, skipped };
}

export async function loadProject(configPath = "contextgate.yaml"): Promise<LoadedProject> {
  const loaded = await loadConfig(configPath);
  const baseDir = dirname(loaded.path);
  const stateDir = resolve(baseDir, loaded.config.stateDir);
  const auditPath = resolve(baseDir, loaded.config.audit.path);
  const config: ContextGateConfig = {
    ...loaded.config,
    stateDir,
    audit: {
      ...loaded.config.audit,
      path: auditPath,
    },
  };

  const policy = await loadPolicyDocument(config, loaded.path);
  return {
    configPath: loaded.path,
    config,
    policy,
    stateDir,
    auditPath,
  };
}

export async function indexTools(configPath?: string): Promise<Tool[]> {
  const project = await loadProject(configPath);
  const store = new CatalogStore(project.stateDir);
  let existing = await store.load().catch((error: unknown) => {
    if (error instanceof CatalogError) {
      return undefined;
    }

    throw error;
  });
  const connectorManager = createConnectorManager(project.config);
  const discovered = await connectorManager.discoverTools();
  const policyEngine = new DefaultPolicyEngine(project.policy);
  const tools = normalizeDiscoveredTools(discovered, project.config.servers, existing?.tools ?? []).map((tool) => ({
    ...tool,
    riskClass: policyEngine.resolveToolPolicy(tool).riskClass,
  }));

  await store.save(tools);

  const audit = new JsonlAuditLog(project.auditPath, { redactSecrets: project.config.audit.redactSecrets });
  await audit.write({
    timestamp: new Date().toISOString(),
    type: "tools_discovered",
    data: {
      count: tools.length,
    },
  });

  return tools;
}

export async function loadCatalogOrIndex(configPath?: string): Promise<{
  project: LoadedProject;
  tools: Tool[];
  indexed: boolean;
}> {
  const project = await loadProject(configPath);
  const store = new CatalogStore(project.stateDir);
  const snapshot = await store.load().catch((error: unknown) => {
    if (error instanceof CatalogError) {
      return undefined;
    }

    throw error;
  });
  if (snapshot) {
    return { project, tools: snapshot.tools, indexed: false };
  }

  const tools = await indexTools(configPath);
  return { project, tools, indexed: true };
}

export async function selectTools(input: {
  prompt: string;
  configPath?: string;
  maxTools?: number;
  dryRun?: boolean;
}): Promise<{ result: SelectToolsResult; indexed: boolean }> {
  const { project, tools, indexed } = await loadCatalogOrIndex(input.configPath);
  const engine = new DefaultSelectionEngine(tools, project.policy, project.config);
  const result = await engine.selectTools({
    prompt: input.prompt,
    maxTools: input.maxTools,
    dryRun: input.dryRun,
  });

  const audit = new JsonlAuditLog(project.auditPath, { redactSecrets: project.config.audit.redactSecrets });
  await audit.write({
    timestamp: new Date().toISOString(),
    type: input.dryRun ? "policy_test" : "task_started",
    taskId: result.taskId,
    decision: "selected",
    reasons: [`selected:${result.selected.length}`, `hidden:${result.hiddenCount}`, `blocked:${result.blockedCount}`],
    data: {
      promptHash: result.promptHash,
      totalTools: result.totalTools,
      selectedToolIds: result.selected.map((item) => item.tool.id),
      hiddenCount: result.hiddenCount,
      blockedCount: result.blockedCount,
      estimatedSchemaTokensSaved: result.estimatedSchemaTokensSaved,
    },
  });

  if (!input.dryRun) {
    await writeTask(project.stateDir, result);
  }

  return { result, indexed };
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

async function writeTask(stateDir: string, result: SelectToolsResult): Promise<void> {
  const taskDir = resolve(stateDir, "tasks");
  await mkdir(taskDir, { recursive: true });
  await writeFile(resolve(taskDir, `${result.taskId}.json`), `${JSON.stringify(result, null, 2)}\n`);
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
