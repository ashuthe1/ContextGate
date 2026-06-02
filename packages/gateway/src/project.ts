import { dirname, resolve } from "node:path";
import {
  CatalogError,
  loadConfig,
  type ContextGateConfig,
  type PolicyDocument,
  type SelectToolsResult,
  type Tool,
} from "../../core/src/index.js";
import { CatalogStore, normalizeDiscoveredTools } from "../../catalog/src/index.js";
import { createConnectorManager } from "../../mcp-client/src/index.js";
import { JsonlAuditLog } from "../../audit/src/index.js";
import { DefaultPolicyEngine, loadPolicyDocument } from "../../policy/src/index.js";
import { DefaultSelectionEngine } from "../../retrieval/src/index.js";
import { CapabilityStore, createCapabilityFromSelection } from "./capability-store.js";

export interface LoadedProject {
  configPath: string;
  config: ContextGateConfig;
  policy: PolicyDocument;
  stateDir: string;
  auditPath: string;
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

  return {
    configPath: loaded.path,
    config,
    policy: await loadPolicyDocument(config, loaded.path),
    stateDir,
    auditPath,
  };
}

export async function indexTools(configPath?: string): Promise<Tool[]> {
  const project = await loadProject(configPath);
  const store = new CatalogStore(project.stateDir);
  const existing = await store.load().catch((error: unknown) => {
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

  await audit(project).write({
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

  return { project, tools: await indexTools(configPath), indexed: true };
}

export async function selectTools(input: {
  prompt: string;
  configPath?: string;
  maxTools?: number;
  dryRun?: boolean;
  userId?: string;
  projectId?: string;
}): Promise<{ result: SelectToolsResult; indexed: boolean }> {
  const { project, tools, indexed } = await loadCatalogOrIndex(input.configPath);
  const engine = new DefaultSelectionEngine(tools, project.policy, project.config);
  const result = await engine.selectTools({
    prompt: input.prompt,
    maxTools: input.maxTools,
    dryRun: input.dryRun,
    userId: input.userId,
    projectId: input.projectId,
  });

  await audit(project).write({
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
    const capabilityStore = new CapabilityStore(project.stateDir);
    await capabilityStore.saveTaskSelection(result);
    const capability = createCapabilityFromSelection(result, project.policy);
    if (capability) {
      await capabilityStore.saveCapability(capability);
    }
  }

  return { result, indexed };
}

export function audit(project: LoadedProject): JsonlAuditLog {
  return new JsonlAuditLog(project.auditPath, { redactSecrets: project.config.audit.redactSecrets });
}
