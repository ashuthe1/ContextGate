import { dirname, resolve } from "node:path";
import {
  CatalogError,
  type CatalogDiff,
  loadConfig,
  type ContextGateConfig,
  type PolicyDocument,
  type ServerHealth,
  type SelectToolsResult,
  type Tool,
} from "../../core/src/index.js";
import { CatalogStore, diffCatalogTools, normalizeDiscoveredTools } from "../../catalog/src/index.js";
import { createConnectorManager } from "../../mcp-client/src/index.js";
import { JsonlAuditLog } from "../../audit/src/index.js";
import { DefaultPolicyEngine, loadPolicyDocument } from "../../policy/src/index.js";
import { DefaultSelectionEngine, retrieveSemanticTools } from "../../retrieval/src/index.js";
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

export async function indexTools(configPath?: string): Promise<{ tools: Tool[]; diff: CatalogDiff }> {
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
  const diff = diffCatalogTools(existing?.tools ?? [], tools);

  await store.save(tools);

  await audit(project).write({
    timestamp: new Date().toISOString(),
    type: "tools_discovered",
    data: {
      count: tools.length,
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
    },
  });

  return { tools, diff };
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

  return { project, tools: (await indexTools(configPath)).tools, indexed: true };
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
  result.promptText = input.prompt;

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

export async function expandTools(input: {
  taskId: string;
  reason: string;
  configPath?: string;
  additionalTools?: number;
}): Promise<SelectToolsResult> {
  const project = await loadProject(input.configPath);
  const capabilityStore = new CapabilityStore(project.stateDir);
  const selection = await capabilityStore.loadTaskSelection(input.taskId);
  const additionalTools = Math.max(1, input.additionalTools ?? 3);
  const policyEngine = new DefaultPolicyEngine(project.policy);
  const selectedIds = new Set(selection.selected.map((item) => item.tool.id));
  const rejectedTools = selection.rejected.map((item) => item.tool);

  const ranked = retrieveSemanticTools(input.reason, rejectedTools)
    .filter((candidate) => !selectedIds.has(candidate.tool.id))
    .map((candidate) => ({
      candidate,
      exposure: policyEngine.evaluateExposure({
        tool: candidate.tool,
        score: candidate.score,
        reasons: [...candidate.reasons, "selection expansion"],
        prompt: selection.promptText ?? input.reason,
      }),
    }))
    .filter(({ exposure }) => exposure.decision === "selected" || exposure.decision === "selected_requires_approval")
    .sort((a, b) => b.candidate.score - a.candidate.score || a.candidate.tool.id.localeCompare(b.candidate.tool.id))
    .slice(0, additionalTools);

  for (const { candidate, exposure } of ranked) {
    selection.selected.push({
      tool: candidate.tool,
      score: candidate.score,
      mode: exposure.mode,
      riskClass: exposure.riskClass,
      requiresApproval: exposure.decision === "selected_requires_approval",
      reasons: exposure.reasons,
    });
  }

  const addedIds = new Set(ranked.map(({ candidate }) => candidate.tool.id));
  selection.rejected = selection.rejected.filter((item) => !addedIds.has(item.tool.id));
  selection.capabilityId = createCapabilityFromSelection(selection, project.policy)?.id;
  selection.hiddenCount = selection.rejected.filter((item) => item.decision === "hidden").length;
  selection.blockedCount = selection.rejected.filter((item) => item.decision === "blocked").length;
  selection.notRelevantCount = selection.rejected.filter((item) => item.decision === "not_relevant").length;

  await capabilityStore.saveTaskSelection(selection);
  const capability = createCapabilityFromSelection(selection, project.policy);
  if (capability) {
    await capabilityStore.saveCapability(capability);
  }

  await audit(project).write({
    timestamp: new Date().toISOString(),
    type: "tools_expanded",
    taskId: selection.taskId,
    decision: "selected",
    reasons: [`reason:${input.reason}`, `added:${ranked.length}`],
    data: {
      addedToolIds: [...addedIds],
    },
  });

  return selection;
}

export async function checkServerHealth(configPath?: string): Promise<ServerHealth[]> {
  const project = await loadProject(configPath);
  const connectorManager = createConnectorManager(project.config);
  const results: ServerHealth[] = [];

  for (const [serverId, server] of Object.entries(project.config.servers)) {
    try {
      const discovered = await connectorManager.discoverServerTools(serverId);
      results.push({
        serverId,
        transport: server.transport,
        status: "ok",
        discoveredTools: discovered.length,
      });
    } catch (error) {
      results.push({
        serverId,
        transport: server.transport,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results.sort((a, b) => a.serverId.localeCompare(b.serverId));
}

export function audit(project: LoadedProject): JsonlAuditLog {
  return new JsonlAuditLog(project.auditPath, { redactSecrets: project.config.audit.redactSecrets });
}
