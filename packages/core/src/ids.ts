import { createHash, randomUUID } from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildToolId(serverId: string, toolName: string): string {
  return `${serverId}.${toolName}`;
}
