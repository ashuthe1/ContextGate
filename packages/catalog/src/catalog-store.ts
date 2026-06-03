import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CatalogDiff, Tool } from "../../core/src/index.js";
import { CatalogError } from "../../core/src/index.js";

export interface CatalogSnapshot {
  version: 1;
  updatedAt: string;
  tools: Tool[];
}

export class CatalogStore {
  constructor(private readonly stateDir: string) {}

  catalogPath(): string {
    return join(this.stateDir, "catalog.json");
  }

  async load(): Promise<CatalogSnapshot | undefined> {
    try {
      const raw = await readFile(this.catalogPath(), "utf8");
      const parsed = JSON.parse(raw) as CatalogSnapshot;
      if (!Array.isArray(parsed.tools)) {
        throw new CatalogError("Catalog file is missing `tools` array.");
      }

      return parsed;
    } catch (error) {
      if (isNotFound(error)) {
        return undefined;
      }

      if (error instanceof SyntaxError) {
        throw new CatalogError(`Catalog file is invalid JSON: ${error.message}`);
      }

      throw error;
    }
  }

  async save(tools: Tool[]): Promise<CatalogSnapshot> {
    await mkdir(this.stateDir, { recursive: true });
    const catalogPath = this.catalogPath();
    const tempPath = `${catalogPath}.${process.pid}.tmp`;
    const snapshot: CatalogSnapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      tools,
    };

    await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    await rename(tempPath, catalogPath);
    return snapshot;
  }
}

export function diffCatalogTools(previous: Tool[] = [], next: Tool[] = []): CatalogDiff {
  const previousById = new Map(previous.map((tool) => [tool.id, tool]));
  const nextById = new Map(next.map((tool) => [tool.id, tool]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  let unchanged = 0;

  for (const [toolId, tool] of nextById) {
    const existing = previousById.get(toolId);
    if (!existing) {
      added.push(toolId);
      continue;
    }

    if (existing.hash !== tool.hash || existing.unavailable !== tool.unavailable) {
      changed.push(toolId);
      continue;
    }

    unchanged += 1;
  }

  for (const toolId of previousById.keys()) {
    if (!nextById.has(toolId)) {
      removed.push(toolId);
    }
  }

  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort(),
    unchanged,
  };
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
