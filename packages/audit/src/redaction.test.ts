import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redaction.js";

describe("redaction", () => {
  it("redacts secret-looking keys recursively", () => {
    const redacted = redactSecrets({
      headers: {
        authorization: "Bearer abc",
      },
      nested: {
        api_key: "sk-test-secret-value-123456",
      },
      safe: "hello",
    });

    expect(redacted).toEqual({
      headers: {
        authorization: "[REDACTED]",
      },
      nested: {
        api_key: "[REDACTED]",
      },
      safe: "hello",
    });
  });
});
