import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { ConfigError } from "./errors.js";
import type { AuditConfig, ContextGateConfig, SelectionConfig, ServerConfig } from "./types.js";

const DEFAULT_SELECTION: SelectionConfig = {
  maxTools: 8,
  maxSchemaTokens: 8000,
  minRelevanceScore: 0.15,
};

const DEFAULT_AUDIT: AuditConfig = {
  path: ".contextgate/audit.jsonl",
  storePromptText: false,
  redactSecrets: true,
};

export async function loadConfig(configPath = "contextgate.yaml"): Promise<{
  path: string;
  config: ContextGateConfig;
}> {
  const absolutePath = resolve(configPath);
  let raw: string;

  try {
    raw = await readFile(absolutePath, "utf8");
  } catch (error) {
    throw new ConfigError(`Could not read config at ${absolutePath}: ${errorMessage(error)}`);
  }

  const parsed = YAML.parse(raw) as unknown;
  return {
    path: absolutePath,
    config: normalizeConfig(parsed, absolutePath),
  };
}

export function normalizeConfig(value: unknown, configPath = "contextgate.yaml"): ContextGateConfig {
  if (!isRecord(value)) {
    throw new ConfigError("Config must be a YAML object.");
  }

  const version = numberOrDefault(value.version, 1);
  const rawServers = value.servers;
  if (!isRecord(rawServers) || Object.keys(rawServers).length === 0) {
    throw new ConfigError("Config must define at least one server under `servers`.");
  }

  const servers: Record<string, ServerConfig> = {};
  for (const [serverId, serverValue] of Object.entries(rawServers)) {
    if (!isRecord(serverValue)) {
      throw new ConfigError(`Server ${serverId} must be an object.`);
    }

    const transport = stringOrDefault(serverValue.transport, "mock");
    if (!["mock", "stdio", "http"].includes(transport)) {
      throw new ConfigError(`Server ${serverId} has unsupported transport ${transport}.`);
    }

    servers[serverId] = {
      transport: transport as ServerConfig["transport"],
      command: optionalString(serverValue.command),
      args: arrayOfStrings(serverValue.args),
      cwd: optionalString(serverValue.cwd),
      env: recordOfStrings(serverValue.env),
      url: optionalString(serverValue.url),
      trust: trustOrDefault(serverValue.trust, "user_configured"),
    };
  }

  const selectionSource = isRecord(value.selection) ? value.selection : {};
  const auditSource = isRecord(value.audit) ? value.audit : {};
  const policySource = isRecord(value.policy) ? value.policy : {};

  return {
    version,
    servers,
    policy: {
      file: optionalString(policySource.file),
    },
    selection: {
      maxTools: numberOrDefault(selectionSource.maxTools, DEFAULT_SELECTION.maxTools),
      maxSchemaTokens: numberOrDefault(selectionSource.maxSchemaTokens, DEFAULT_SELECTION.maxSchemaTokens),
      minRelevanceScore: numberOrDefault(
        selectionSource.minRelevanceScore,
        DEFAULT_SELECTION.minRelevanceScore,
      ),
    },
    audit: {
      path: stringOrDefault(auditSource.path, DEFAULT_AUDIT.path),
      storePromptText: booleanOrDefault(auditSource.storePromptText, DEFAULT_AUDIT.storePromptText),
      redactSecrets: booleanOrDefault(auditSource.redactSecrets, DEFAULT_AUDIT.redactSecrets),
    },
    stateDir: stringOrDefault(value.stateDir, ".contextgate"),
  };
}

export function defaultConfigText(): string {
  return [
    "version: 1",
    "",
    "servers:",
    "  jira:",
    "    transport: mock",
    "    trust: user_configured",
    "  github:",
    "    transport: mock",
    "    trust: user_configured",
    "  slack:",
    "    transport: mock",
    "    trust: user_configured",
    "  filesystem:",
    "    transport: mock",
    "    trust: user_configured",
    "  database:",
    "    transport: mock",
    "    trust: user_configured",
    "  shell:",
    "    transport: mock",
    "    trust: user_configured",
    "  kubernetes:",
    "    transport: mock",
    "    trust: user_configured",
    "  stripe:",
    "    transport: mock",
    "    trust: user_configured",
    "",
    "policy:",
    "  file: examples/policies/coding-agent-safe.yaml",
    "",
    "selection:",
    "  maxTools: 8",
    "  maxSchemaTokens: 8000",
    "  minRelevanceScore: 0.15",
    "",
    "audit:",
    "  path: .contextgate/audit.jsonl",
    "  storePromptText: false",
    "  redactSecrets: true",
    "",
    "stateDir: .contextgate",
    "",
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function arrayOfStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function recordOfStrings(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function trustOrDefault(value: unknown, fallback: ServerConfig["trust"]): ServerConfig["trust"] {
  if (value === "trusted" || value === "user_configured" || value === "unknown") {
    return value;
  }

  return fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
