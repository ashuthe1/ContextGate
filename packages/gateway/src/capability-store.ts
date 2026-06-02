import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Capability, PolicyDocument, SelectToolsResult } from "../../core/src/index.js";

export class CapabilityStore {
  constructor(private readonly stateDir: string) {}

  taskPath(taskId: string): string {
    return join(this.stateDir, "tasks", `${taskId}.json`);
  }

  capabilityPath(capabilityId: string): string {
    return join(this.stateDir, "capabilities", `${capabilityId}.json`);
  }

  async saveTaskSelection(result: SelectToolsResult): Promise<void> {
    await mkdir(join(this.stateDir, "tasks"), { recursive: true });
    await writeFile(this.taskPath(result.taskId), `${JSON.stringify(result, null, 2)}\n`);
  }

  async loadTaskSelection(taskId: string): Promise<SelectToolsResult> {
    const raw = await readFile(this.taskPath(taskId), "utf8");
    return JSON.parse(raw) as SelectToolsResult;
  }

  async saveCapability(capability: Capability): Promise<void> {
    await mkdir(join(this.stateDir, "capabilities"), { recursive: true });
    await writeFile(this.capabilityPath(capability.id), `${JSON.stringify(capability, null, 2)}\n`);
  }

  async loadCapability(capabilityId: string): Promise<Capability> {
    const raw = await readFile(this.capabilityPath(capabilityId), "utf8");
    return JSON.parse(raw) as Capability;
  }
}

export function createCapabilityFromSelection(
  result: SelectToolsResult,
  policy: PolicyDocument,
): Capability | undefined {
  if (!result.capabilityId) {
    return undefined;
  }

  return {
    id: result.capabilityId,
    taskId: result.taskId,
    toolIds: result.selected.map((item) => item.tool.id),
    expiresAt: new Date(Date.now() + policy.defaults.capabilityTtlMinutes * 60_000).toISOString(),
    callLimits: {
      maxCallsTotal: 50,
      maxCallsPerTool: 20,
    },
    resourceConstraints: {},
  };
}
