import { mkdtemp, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { handleRequest } from "./server.js";

describe("daemon", () => {
  it("serves health checks without opening a socket", async () => {
    const request = Readable.from([]) as IncomingMessage;
    request.method = "GET";
    request.url = "/health";

    const response = new MockResponse();
    await handleRequest(request, response as unknown as ServerResponse, {});

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: "ok" });
  });

  it("serves server health for configured mock integrations", async () => {
    const configPath = await writeTestProject();
    const request = Readable.from([]) as IncomingMessage;
    request.method = "GET";
    request.url = "/v1/server-health";

    const response = new MockResponse();
    await handleRequest(request, response as unknown as ServerResponse, { configPath });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual([
      { serverId: "github", transport: "mock", status: "ok", discoveredTools: 9 },
      { serverId: "jira", transport: "mock", status: "ok", discoveredTools: 4 },
    ]);
  });
});

class MockResponse {
  status?: number;
  headers?: Record<string, string>;
  body = "";

  writeHead(status: number, headers: Record<string, string>): void {
    this.status = status;
    this.headers = headers;
  }

  end(body: string): void {
    this.body += body;
  }
}

async function writeTestProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "contextgate-daemon-test-"));
  const configPath = join(root, "contextgate.yaml");

  await writeFile(
    configPath,
    [
      "version: 1",
      "servers:",
      "  jira:",
      "    transport: mock",
      "    trust: user_configured",
      "  github:",
      "    transport: mock",
      "    trust: user_configured",
      "selection:",
      "  maxTools: 8",
      "  maxSchemaTokens: 8000",
      "  minRelevanceScore: 0.10",
      "audit:",
      "  path: .contextgate/audit.jsonl",
      "  storePromptText: false",
      "  redactSecrets: true",
      "stateDir: .contextgate",
      "",
    ].join("\n"),
  );

  return configPath;
}
