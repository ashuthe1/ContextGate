import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  defaultConfigText,
  type SelectToolsResult,
} from "../../../packages/core/src/index.js";
export {
  indexTools,
  loadProject,
  selectTools,
  type LoadedProject,
} from "../../../packages/gateway/src/index.js";

export async function initProject(options: { force?: boolean }): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  await writeIfAllowed("contextgate.yaml", defaultConfigText(), options.force, created, skipped);

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
