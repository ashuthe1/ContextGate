import type { SelectToolsInput, SelectToolsResult, ServerHealth } from "../../core/src/index.js";
import type { ToolCallResult } from "../../gateway/src/index.js";

export interface ContextGateOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export interface ContextGateCallInput {
  taskId: string;
  capabilityId: string;
  toolId: string;
  arguments: Record<string, unknown>;
  approval?: {
    approved: boolean;
    approver?: string;
    reason?: string;
  };
}

export class ContextGate {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: ContextGateOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof this.fetchImpl !== "function") {
      throw new Error("ContextGate requires a fetch implementation.");
    }
  }

  async health(): Promise<{ status: string }> {
    return this.request("/health", { method: "GET" });
  }

  async serverHealth(): Promise<ServerHealth[]> {
    return this.request("/v1/server-health", { method: "GET" });
  }

  async selectTools(input: SelectToolsInput): Promise<SelectToolsResult> {
    return this.request("/v1/tool-selection", {
      method: "POST",
      body: JSON.stringify({
        prompt: input.prompt,
        userId: input.userId,
        projectId: input.projectId,
        maxTools: input.maxTools,
      }),
    });
  }

  async callTool(input: ContextGateCallInput): Promise<ToolCallResult> {
    return this.request("/v1/tool-call", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async explainTask(taskId: string): Promise<SelectToolsResult> {
    return this.request(`/v1/tasks/${encodeURIComponent(taskId)}/explanation`, { method: "GET" });
  }

  async expandTools(taskId: string, reason: string, additionalTools?: number): Promise<SelectToolsResult> {
    return this.request(`/v1/tasks/${encodeURIComponent(taskId)}/expand`, {
      method: "POST",
      body: JSON.stringify({
        reason,
        additionalTools,
      }),
    });
  }

  private async request(path: string, init: RequestInit): Promise<any> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    const data = text.length > 0 ? (JSON.parse(text) as unknown) : undefined;

    if (response.status >= 400) {
      const message =
        typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : `ContextGate request failed with status ${response.status}`;
      throw new Error(message);
    }

    return data;
  }
}
