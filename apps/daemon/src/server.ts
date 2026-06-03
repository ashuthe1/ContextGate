import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { parse } from "node:url";
import {
  CapabilityStore,
  LocalExecutionGateway,
  checkServerHealth,
  expandTools,
  loadProject,
  selectTools,
} from "../../../packages/gateway/src/index.js";
import type { JsonObject } from "../../../packages/core/src/index.js";
import { approveRequest, denyRequest } from "./approval-actions.js";
import { loadPolicyEditor, savePolicyEditor } from "./policy-view.js";
import { listPendingApprovals, listTaskSummaries, listTaskTimeline, loadCatalogSnapshot } from "./state-view.js";
import { renderUiHtml, renderUiScript, renderUiStyles } from "./ui.js";

export interface DaemonOptions {
  configPath?: string;
  port?: number;
  host?: string;
}

export function startDaemon(options: DaemonOptions = {}): Promise<{ url: string; close: () => Promise<void> }> {
  const port = options.port ?? 3737;
  const host = options.host ?? "127.0.0.1";
  const server = createServer((request, response) => {
    handleRequest(request, response, options).catch((error: unknown) => {
      writeJson(response, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address() as AddressInfo;
      const actualPort = typeof address === "object" && address !== null ? address.port : port;
      resolve({
        url: `http://${host}:${actualPort}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
              } else {
                closeResolve();
              }
            });
          }),
      });
    });
  });
}

export async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: DaemonOptions,
): Promise<void> {
  const method = request.method ?? "GET";
  const pathname = parse(request.url ?? "/").pathname ?? "/";

  if (method === "GET" && pathname === "/health") {
    writeJson(response, 200, { status: "ok" });
    return;
  }

  if (method === "GET" && pathname === "/") {
    response.writeHead(302, { location: "/ui" });
    response.end();
    return;
  }

  if (method === "GET" && pathname === "/ui") {
    writeText(response, 200, renderUiHtml(), "text/html; charset=utf-8");
    return;
  }

  if (method === "GET" && pathname === "/ui/app.js") {
    writeText(response, 200, renderUiScript(), "text/javascript; charset=utf-8");
    return;
  }

  if (method === "GET" && pathname === "/ui/styles.css") {
    writeText(response, 200, renderUiStyles(), "text/css; charset=utf-8");
    return;
  }

  if (method === "GET" && pathname === "/v1/server-health") {
    writeJson(response, 200, await checkServerHealth(options.configPath));
    return;
  }

  if (method === "GET" && pathname === "/v1/policy") {
    writeJson(response, 200, await loadPolicyEditor(options.configPath));
    return;
  }

  if (method === "PUT" && pathname === "/v1/policy") {
    const body = await readJson(request);
    if (!isRecord(body) || typeof body.text !== "string") {
      writeJson(response, 400, { error: "body.text must be a string" });
      return;
    }

    writeJson(response, 200, await savePolicyEditor(options.configPath, body.text));
    return;
  }

  if (method === "GET" && pathname === "/v1/catalog") {
    const project = await loadProject(options.configPath);
    writeJson(response, 200, await loadCatalogSnapshot(project.stateDir));
    return;
  }

  if (method === "GET" && pathname === "/v1/tasks") {
    const project = await loadProject(options.configPath);
    writeJson(response, 200, await listTaskSummaries(project.stateDir));
    return;
  }

  if (method === "GET" && pathname === "/v1/approvals") {
    const project = await loadProject(options.configPath);
    writeJson(response, 200, await listPendingApprovals(project.auditPath));
    return;
  }

  const approvalApproveMatch = pathname.match(/^\/v1\/approvals\/([^/]+)\/approve$/);
  if (method === "POST" && approvalApproveMatch) {
    const body = await readJson(request);
    writeJson(
      response,
      200,
      await approveRequest({
        approvalId: decodeURIComponent(approvalApproveMatch[1]),
        configPath: options.configPath,
        approver: isRecord(body) && typeof body.approver === "string" ? body.approver : undefined,
        reason: isRecord(body) && typeof body.reason === "string" ? body.reason : undefined,
      }),
    );
    return;
  }

  const approvalDenyMatch = pathname.match(/^\/v1\/approvals\/([^/]+)\/deny$/);
  if (method === "POST" && approvalDenyMatch) {
    const body = await readJson(request);
    writeJson(
      response,
      200,
      await denyRequest({
        approvalId: decodeURIComponent(approvalDenyMatch[1]),
        configPath: options.configPath,
        approver: isRecord(body) && typeof body.approver === "string" ? body.approver : undefined,
        reason: isRecord(body) && typeof body.reason === "string" ? body.reason : undefined,
      }),
    );
    return;
  }

  if (method === "POST" && pathname === "/v1/tool-selection") {
    const body = await readJson(request);
    if (!isRecord(body) || typeof body.prompt !== "string") {
      writeJson(response, 400, { error: "body.prompt must be a string" });
      return;
    }

    const selected = await selectTools({
      prompt: body.prompt,
      configPath: options.configPath,
      maxTools: typeof body.maxTools === "number" ? body.maxTools : undefined,
      userId: typeof body.userId === "string" ? body.userId : undefined,
      projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    });

    writeJson(response, 200, selected.result);
    return;
  }

  if (method === "POST" && pathname === "/v1/tool-call") {
    const body = await readJson(request);
    if (!isToolCallBody(body)) {
      writeJson(response, 400, {
        error: "body must include taskId, capabilityId, toolId, and arguments object",
      });
      return;
    }

    const gateway = new LocalExecutionGateway();
    const result = await gateway.callTool({
      configPath: options.configPath,
      taskId: body.taskId,
      capabilityId: body.capabilityId,
      toolId: body.toolId,
      arguments: body.arguments,
      approval: isRecord(body.approval)
        ? {
            approved: body.approval.approved === true,
            approver: typeof body.approval.approver === "string" ? body.approval.approver : undefined,
            reason: typeof body.approval.reason === "string" ? body.approval.reason : undefined,
          }
        : undefined,
    });

    const status = result.decision === "blocked" ? 403 : result.decision === "approval_required" ? 202 : 200;
    writeJson(response, status, result);
    return;
  }

  const taskMatch = pathname.match(/^\/v1\/tasks\/([^/]+)\/explanation$/);
  if (method === "GET" && taskMatch) {
    const project = await loadProject(options.configPath);
    const store = new CapabilityStore(project.stateDir);
    const task = await store.loadTaskSelection(decodeURIComponent(taskMatch[1]));
    writeJson(response, 200, task);
    return;
  }

  const timelineMatch = pathname.match(/^\/v1\/tasks\/([^/]+)\/timeline$/);
  if (method === "GET" && timelineMatch) {
    const project = await loadProject(options.configPath);
    writeJson(response, 200, await listTaskTimeline(project.auditPath, decodeURIComponent(timelineMatch[1])));
    return;
  }

  const expandMatch = pathname.match(/^\/v1\/tasks\/([^/]+)\/expand$/);
  if (method === "POST" && expandMatch) {
    const body = await readJson(request);
    if (!isRecord(body) || typeof body.reason !== "string") {
      writeJson(response, 400, { error: "body.reason must be a string" });
      return;
    }

    const result = await expandTools({
      taskId: decodeURIComponent(expandMatch[1]),
      reason: body.reason,
      configPath: options.configPath,
      additionalTools: typeof body.additionalTools === "number" ? body.additionalTools : undefined,
    });
    writeJson(response, 200, result);
    return;
  }

  writeJson(response, 404, { error: "not found" });
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function writeText(response: ServerResponse, status: number, body: string, contentType: string): void {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
}

function isToolCallBody(value: unknown): value is {
  taskId: string;
  capabilityId: string;
  toolId: string;
  arguments: JsonObject;
  approval?: JsonObject;
} {
  return (
    isRecord(value) &&
    typeof value.taskId === "string" &&
    typeof value.capabilityId === "string" &&
    typeof value.toolId === "string" &&
    isRecord(value.arguments)
  );
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
