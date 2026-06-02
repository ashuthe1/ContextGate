import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { ConfigError, type JsonObject, type McpToolDefinition, type ServerConfig } from "../../core/src/index.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: JsonObject;
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: JsonObject;
}

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: number;
  result: unknown;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcSuccess | JsonRpcFailure;

export class StdioMcpClient {
  private child?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private stdoutBuffer = Buffer.alloc(0);
  private readonly pending = new Map<
    number,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  constructor(
    private readonly serverId: string,
    private readonly config: ServerConfig,
  ) {}

  async connect(): Promise<void> {
    if (!this.config.command) {
      throw new ConfigError(`Stdio server ${this.serverId} requires command.`);
    }

    this.child = spawn(this.config.command, this.config.args ?? [], {
      cwd: this.config.cwd,
      env: {
        ...process.env,
        ...(this.config.env ?? {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.once("exit", (code, signal) => {
      const reason = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
      this.rejectAll(new Error(`Stdio MCP server ${this.serverId} exited with ${reason}.`));
    });

    this.child.once("error", (error) => {
      this.rejectAll(error instanceof Error ? error : new Error(String(error)));
    });

    this.child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8").trim();
      if (text.length > 0) {
        process.stderr.write(`[contextgate:${this.serverId}:stderr] ${text}\n`);
      }
    });

    if (!this.child.stdout || !this.child.stdin) {
      throw new ConfigError(`Could not open stdio pipes for server ${this.serverId}.`);
    }

    this.child.stdout.on("data", (chunk: Buffer) => this.handleChunk(chunk));

    await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "contextgate",
        version: "0.1.0",
      },
    });

    this.notify("notifications/initialized", {});
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const result = await this.request("tools/list", {});
    if (!isRecord(result) || !Array.isArray(result.tools)) {
      throw new ConfigError(`Stdio server ${this.serverId} returned invalid tools/list result.`);
    }

    return result.tools.map((tool) => normalizeTool(this.serverId, tool));
  }

  async callTool(toolName: string, args: unknown): Promise<unknown> {
    return this.request("tools/call", {
      name: toolName,
      arguments: isRecord(args) ? (args as JsonObject) : {},
    });
  }

  async close(): Promise<void> {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Stdio MCP server ${this.serverId} closed.`));
    }
    this.pending.clear();

    if (!this.child || this.child.killed) {
      return;
    }

    this.child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 250);
      this.child?.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private request(method: string, params: JsonObject): Promise<unknown> {
    if (!this.child?.stdin) {
      return Promise.reject(new ConfigError(`Stdio server ${this.serverId} is not connected.`));
    }

    const id = this.nextId++;
    const message: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new ConfigError(`Request ${method} to stdio server ${this.serverId} timed out.`));
      }, 10_000);

      this.pending.set(id, { resolve, reject, timeout });
      this.write(message);
    });
  }

  private notify(method: string, params: JsonObject): void {
    this.write({
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  private write(message: JsonRpcRequest | JsonRpcNotification): void {
    const payload = JSON.stringify(message);
    this.child?.stdin?.write(`Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`);
  }

  private handleChunk(chunk: Buffer): void {
    this.stdoutBuffer = Buffer.concat([this.stdoutBuffer, chunk]);

    while (true) {
      const separatorIndex = this.stdoutBuffer.indexOf("\r\n\r\n");
      if (separatorIndex === -1) {
        return;
      }

      const headerText = this.stdoutBuffer.subarray(0, separatorIndex).toString("utf8");
      const contentLength = parseContentLength(headerText);
      if (contentLength === undefined) {
        process.stderr.write(`[contextgate:${this.serverId}:stdout] ignored frame with invalid headers.\n`);
        this.stdoutBuffer = this.stdoutBuffer.subarray(separatorIndex + 4);
        continue;
      }

      const bodyStart = separatorIndex + 4;
      if (this.stdoutBuffer.byteLength - bodyStart < contentLength) {
        return;
      }

      const body = this.stdoutBuffer.subarray(bodyStart, bodyStart + contentLength).toString("utf8");
      this.stdoutBuffer = this.stdoutBuffer.subarray(bodyStart + contentLength);
      this.handleMessage(body);
    }
  }

  private handleMessage(body: string): void {
    let parsed: JsonRpcMessage;
    try {
      parsed = JSON.parse(body) as JsonRpcMessage;
    } catch {
      process.stderr.write(`[contextgate:${this.serverId}:stdout] ignored invalid json message.\n`);
      return;
    }

    if (!isRecord(parsed) || typeof parsed.id !== "number") {
      return;
    }

    const pending = this.pending.get(parsed.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(parsed.id);

    if ("error" in parsed && isRpcError(parsed.error)) {
      pending.reject(new ConfigError(`MCP ${this.serverId} error: ${parsed.error.message}`));
      return;
    }

    if ("result" in parsed) {
      pending.resolve(parsed.result);
      return;
    }

    pending.reject(new ConfigError(`MCP ${this.serverId} returned response without result or error.`));
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`${error.message} Pending request id: ${id}`));
    }
    this.pending.clear();
  }
}

function normalizeTool(serverId: string, value: unknown): McpToolDefinition {
  if (!isRecord(value) || typeof value.name !== "string") {
    throw new ConfigError(`Stdio server ${serverId} returned a tool without a string name.`);
  }

  return {
    name: value.name,
    title: typeof value.title === "string" ? value.title : undefined,
    description: typeof value.description === "string" ? value.description : undefined,
    inputSchema: isRecord(value.inputSchema) ? (value.inputSchema as JsonObject) : { type: "object" },
    outputSchema: isRecord(value.outputSchema) ? (value.outputSchema as JsonObject) : undefined,
    annotations: isRecord(value.annotations) ? (value.annotations as JsonObject) : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRpcError(value: unknown): value is JsonRpcFailure["error"] {
  return isRecord(value) && typeof value.message === "string";
}

function parseContentLength(headers: string): number | undefined {
  const match = headers.match(/(?:^|\r\n)Content-Length:\s*(\d+)(?:\r\n|$)/i);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
