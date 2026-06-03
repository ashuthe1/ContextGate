import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { CatalogStore } from "../../../packages/catalog/src/index.js";
import type { ApprovalSummary, AuditEvent, SelectToolsResult, TaskSummary } from "../../../packages/core/src/index.js";

export async function listTaskSummaries(stateDir: string): Promise<TaskSummary[]> {
  const tasksDir = join(stateDir, "tasks");
  let files: string[];
  try {
    files = (await readdir(tasksDir)).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }

  const tasks = await Promise.all(
    files.map(async (file) => parseTaskSummary(await readFile(join(tasksDir, file), "utf8"))),
  );

  return tasks.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function loadCatalogSnapshot(stateDir: string) {
  return new CatalogStore(stateDir).load();
}

export async function loadAuditEvents(auditPath: string): Promise<AuditEvent[]> {
  let raw: string;
  try {
    raw = await readFile(auditPath, "utf8");
  } catch {
    return [];
  }

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as AuditEvent);
}

export async function listTaskTimeline(auditPath: string, taskId: string): Promise<AuditEvent[]> {
  const events = await loadAuditEvents(auditPath);
  return events
    .filter((event) => event.taskId === taskId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function listPendingApprovals(auditPath: string): Promise<ApprovalSummary[]> {
  const events = await loadAuditEvents(auditPath);
  const pending = new Map<string, ApprovalSummary>();

  for (const event of events) {
    const key = event.taskId && event.toolId ? `${event.taskId}:${event.toolId}` : undefined;
    if (!key) {
      continue;
    }

    if (event.type === "approval_requested") {
      pending.set(key, {
        taskId: event.taskId!,
        toolId: event.toolId!,
        approvalId:
          event.data && typeof event.data === "object" && "approvalId" in event.data && typeof event.data.approvalId === "string"
            ? event.data.approvalId
            : undefined,
        timestamp: event.timestamp,
        reasons: event.reasons ?? [],
      });
      continue;
    }

    if (event.type === "approval_granted" || event.type === "tool_call_finished" || event.type === "tool_blocked") {
      pending.delete(key);
    }
  }

  return [...pending.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function parseTaskSummary(raw: string): TaskSummary {
  const parsed = JSON.parse(raw) as SelectToolsResult;
  return {
    taskId: parsed.taskId,
    capabilityId: parsed.capabilityId,
    promptText: parsed.promptText,
    promptHash: parsed.promptHash,
    selectedCount: parsed.selected.length,
    hiddenCount: parsed.hiddenCount,
    blockedCount: parsed.blockedCount,
    createdAt: findCreatedAt(parsed),
  };
}

function findCreatedAt(selection: SelectToolsResult): string | undefined {
  const firstSeen = selection.selected
    .map((item) => item.tool.lastSeenAt)
    .filter((value): value is string => typeof value === "string")
    .sort()[0];
  return firstSeen;
}
