import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
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
