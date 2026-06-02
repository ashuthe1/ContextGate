import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

export function resolveFrom(baseFile: string, maybeRelative: string): string {
  if (maybeRelative.startsWith("/")) {
    return maybeRelative;
  }

  return resolve(dirname(baseFile), maybeRelative);
}
