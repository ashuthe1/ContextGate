export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type RiskClass =
  | "read"
  | "write_safe"
  | "write_external"
  | "destructive"
  | "privileged_infra"
  | "monetary"
  | "credential_access"
  | "unknown";

export type PolicyMode = "allow" | "ask" | "deny" | "hide" | "shadow";

export type ExposureDecisionKind =
  | "selected"
  | "selected_requires_approval"
  | "hidden"
  | "blocked"
  | "not_relevant";

export type ExecutionDecisionKind = "allow" | "require_approval" | "block";

export interface McpToolDefinition {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonObject;
  outputSchema?: JsonObject;
  annotations?: JsonObject;
}

export interface DiscoveredTool {
  serverId: string;
  definition: McpToolDefinition;
}

export interface Tool {
  id: string;
  serverId: string;
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonObject;
  outputSchema?: JsonObject;
  annotations?: JsonObject;
  trustLevel: "trusted" | "user_configured" | "unknown";
  riskClass: RiskClass;
  hash: string;
  firstSeenAt: string;
  lastSeenAt: string;
  unavailable?: boolean;
}

export interface CandidateTool {
  tool: Tool;
  score: number;
  reasons: string[];
}

export interface SelectedTool {
  tool: Tool;
  score: number;
  mode: PolicyMode;
  riskClass: RiskClass;
  requiresApproval: boolean;
  reasons: string[];
}

export interface RejectedTool {
  tool: Tool;
  score?: number;
  decision: Exclude<ExposureDecisionKind, "selected" | "selected_requires_approval">;
  reasons: string[];
}

export interface SelectToolsInput {
  prompt: string;
  userId?: string;
  projectId?: string;
  maxTools?: number;
  dryRun?: boolean;
}

export interface SelectToolsResult {
  taskId: string;
  capabilityId?: string;
  promptText?: string;
  promptHash: string;
  totalTools: number;
  candidates: CandidateTool[];
  selected: SelectedTool[];
  rejected: RejectedTool[];
  hiddenCount: number;
  blockedCount: number;
  notRelevantCount: number;
  estimatedSchemaTokensSaved: number;
}

export interface CatalogDiff {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: number;
}

export interface ServerHealth {
  serverId: string;
  transport: "mock" | "stdio" | "http";
  status: "ok" | "error";
  discoveredTools?: number;
  error?: string;
}

export interface TaskSummary {
  taskId: string;
  capabilityId?: string;
  promptText?: string;
  promptHash: string;
  selectedCount: number;
  hiddenCount: number;
  blockedCount: number;
  createdAt?: string;
}

export interface ApprovalSummary {
  taskId: string;
  toolId: string;
  approvalId?: string;
  timestamp: string;
  reasons: string[];
}

export interface Task {
  id: string;
  userId?: string;
  projectId?: string;
  promptText?: string;
  promptHash: string;
  createdAt: string;
  maxTools: number;
  maxSchemaTokens: number;
}

export interface Capability {
  id: string;
  taskId: string;
  toolIds: string[];
  expiresAt: string;
  callLimits: {
    maxCallsPerTool?: number;
    maxCallsTotal?: number;
  };
  resourceConstraints: JsonObject;
}

export interface ToolSelection {
  taskId: string;
  toolId: string;
  score: number;
  decision: ExposureDecisionKind;
  reasons: string[];
  policyRuleId?: string;
}

export interface ToolCall {
  id: string;
  taskId: string;
  capabilityId: string;
  toolId: string;
  arguments: JsonObject;
  decision: ExecutionDecisionKind;
  approvalId?: string;
  startedAt?: string;
  finishedAt?: string;
  latencyMs?: number;
  resultSummary?: string;
  error?: string;
}

export interface ExposureInput {
  tool: Tool;
  score: number;
  reasons: string[];
  prompt: string;
  userId?: string;
  projectId?: string;
}

export interface ExposureDecision {
  decision: ExposureDecisionKind;
  mode: PolicyMode;
  riskClass: RiskClass;
  reasons: string[];
  policyRuleId?: string;
}

export interface ExecutionInput {
  tool: Tool;
  arguments: JsonObject;
  taskId: string;
  capabilityId: string;
  userId?: string;
  projectId?: string;
}

export interface ExecutionDecision {
  decision: ExecutionDecisionKind;
  mode: PolicyMode;
  riskClass: RiskClass;
  reasons: string[];
  policyRuleId?: string;
}

export interface AuditEvent {
  timestamp: string;
  type: string;
  taskId?: string;
  toolId?: string;
  decision?: string;
  reasons?: string[];
  data?: JsonObject;
}

export interface ServerConfig {
  transport: "mock" | "stdio" | "http";
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  trust?: "trusted" | "user_configured" | "unknown";
}

export interface SelectionConfig {
  maxTools: number;
  maxSchemaTokens: number;
  minRelevanceScore: number;
}

export interface AuditConfig {
  path: string;
  storePromptText: boolean;
  redactSecrets: boolean;
}

export interface ContextGateConfig {
  version: number;
  servers: Record<string, ServerConfig>;
  policy: {
    file?: string;
  };
  selection: SelectionConfig;
  audit: AuditConfig;
  stateDir: string;
}

export interface ToolPolicy {
  mode?: PolicyMode;
  risk?: RiskClass;
  constraints?: JsonObject;
}

export interface ServerPolicy {
  trust?: "trusted" | "user_configured" | "unknown";
  defaultMode?: PolicyMode;
}

export interface PolicyDocument {
  version: number;
  defaults: {
    unknownToolMode: PolicyMode;
    selectedToolLimit: number;
    maxSchemaTokens: number;
    capabilityTtlMinutes: number;
  };
  servers: Record<string, ServerPolicy>;
  tools: Record<string, ToolPolicy>;
  selection: {
    maxTools: number;
    minRelevanceScore: number;
    riskPenalties: Partial<Record<RiskClass, number>>;
  };
  logging: {
    storePromptText: boolean;
    redactSecrets: boolean;
    auditPath: string;
  };
}
