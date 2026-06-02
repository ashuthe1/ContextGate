import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import YAML from "yaml";
import type {
  ContextGateConfig,
  JsonObject,
  PolicyDocument,
  PolicyMode,
  RiskClass,
} from "../../core/src/index.js";
import { ConfigError } from "../../core/src/index.js";

export async function loadPolicyDocument(
  config: ContextGateConfig,
  configPath = "contextgate.yaml",
): Promise<PolicyDocument> {
  if (!config.policy.file) {
    return defaultPolicyDocument(config);
  }

  const policyPath = config.policy.file.startsWith("/")
    ? config.policy.file
    : resolve(dirname(resolve(configPath)), config.policy.file);

  let parsed: unknown;
  try {
    parsed = YAML.parse(await readFile(policyPath, "utf8"));
  } catch (error) {
    throw new ConfigError(`Could not read policy file ${policyPath}: ${errorMessage(error)}`);
  }

  return normalizePolicyDocument(parsed, config);
}

export function defaultPolicyDocument(config: ContextGateConfig): PolicyDocument {
  return {
    version: 1,
    defaults: {
      unknownToolMode: "ask",
      selectedToolLimit: config.selection.maxTools,
      maxSchemaTokens: config.selection.maxSchemaTokens,
      capabilityTtlMinutes: 30,
    },
    servers: {},
    tools: {},
    selection: {
      maxTools: config.selection.maxTools,
      minRelevanceScore: config.selection.minRelevanceScore,
      riskPenalties: defaultRiskPenalties(),
    },
    logging: {
      storePromptText: config.audit.storePromptText,
      redactSecrets: config.audit.redactSecrets,
      auditPath: config.audit.path,
    },
  };
}

function normalizePolicyDocument(value: unknown, config: ContextGateConfig): PolicyDocument {
  if (!isRecord(value)) {
    throw new ConfigError("Policy file must be a YAML object.");
  }

  const fallback = defaultPolicyDocument(config);
  const defaults = isRecord(value.defaults) ? value.defaults : {};
  const selection = isRecord(value.selection) ? value.selection : {};
  const logging = isRecord(value.logging) ? value.logging : {};

  return {
    version: numberOrDefault(value.version, 1),
    defaults: {
      unknownToolMode: policyModeOrDefault(defaults.unknownToolMode, fallback.defaults.unknownToolMode),
      selectedToolLimit: numberOrDefault(defaults.selectedToolLimit, fallback.defaults.selectedToolLimit),
      maxSchemaTokens: numberOrDefault(defaults.maxSchemaTokens, fallback.defaults.maxSchemaTokens),
      capabilityTtlMinutes: numberOrDefault(
        defaults.capabilityTtlMinutes,
        fallback.defaults.capabilityTtlMinutes,
      ),
    },
    servers: normalizeServers(value.servers),
    tools: normalizeTools(value.tools),
    selection: {
      maxTools: numberOrDefault(selection.maxTools, fallback.selection.maxTools),
      minRelevanceScore: numberOrDefault(selection.minRelevanceScore, fallback.selection.minRelevanceScore),
      riskPenalties: {
        ...fallback.selection.riskPenalties,
        ...(isRecord(selection.riskPenalties)
          ? Object.fromEntries(
              Object.entries(selection.riskPenalties).filter(([, penalty]) => typeof penalty === "number"),
            )
          : {}),
      },
    },
    logging: {
      storePromptText: booleanOrDefault(logging.storePromptText, fallback.logging.storePromptText),
      redactSecrets: booleanOrDefault(logging.redactSecrets, fallback.logging.redactSecrets),
      auditPath: stringOrDefault(logging.auditPath, fallback.logging.auditPath),
    },
  };
}

function normalizeServers(value: unknown): PolicyDocument["servers"] {
  if (!isRecord(value)) {
    return {};
  }

  const servers: PolicyDocument["servers"] = {};
  for (const [serverId, serverValue] of Object.entries(value)) {
    if (!isRecord(serverValue)) {
      continue;
    }

    servers[serverId] = {
      trust: trustOrUndefined(serverValue.trust),
      defaultMode: policyModeOrUndefined(serverValue.defaultMode ?? serverValue.default_mode),
    };
  }

  return servers;
}

function normalizeTools(value: unknown): PolicyDocument["tools"] {
  if (!isRecord(value)) {
    return {};
  }

  const tools: PolicyDocument["tools"] = {};
  for (const [toolId, toolValue] of Object.entries(value)) {
    if (!isRecord(toolValue)) {
      continue;
    }

    tools[toolId] = {
      mode: policyModeOrUndefined(toolValue.mode),
      risk: riskClassOrUndefined(toolValue.risk),
      constraints: isRecord(toolValue.constraints) ? (toolValue.constraints as JsonObject) : undefined,
    };
  }

  return tools;
}

export function defaultRiskPenalties(): Partial<Record<RiskClass, number>> {
  return {
    read: 0,
    write_safe: 0.05,
    write_external: 0.15,
    destructive: 0.35,
    privileged_infra: 0.35,
    monetary: 0.45,
    credential_access: 0.5,
    unknown: 0.25,
  };
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

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function policyModeOrUndefined(value: unknown): PolicyMode | undefined {
  return value === "allow" || value === "ask" || value === "deny" || value === "hide" || value === "shadow"
    ? value
    : undefined;
}

function policyModeOrDefault(value: unknown, fallback: PolicyMode): PolicyMode {
  return policyModeOrUndefined(value) ?? fallback;
}

function riskClassOrUndefined(value: unknown): RiskClass | undefined {
  return value === "read" ||
    value === "write_safe" ||
    value === "write_external" ||
    value === "destructive" ||
    value === "privileged_infra" ||
    value === "monetary" ||
    value === "credential_access" ||
    value === "unknown"
    ? value
    : undefined;
}

function trustOrUndefined(value: unknown): "trusted" | "user_configured" | "unknown" | undefined {
  return value === "trusted" || value === "user_configured" || value === "unknown" ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
