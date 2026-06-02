import type { JsonObject, JsonValue } from "../../core/src/index.js";

const SECRET_KEYS = ["authorization", "api_key", "apikey", "access_token", "refresh_token", "password", "secret"];
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function redactSecrets<T extends JsonValue | JsonObject | unknown>(value: T): T {
  return redact(value) as T;
}

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), value);
  }

  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (typeof value === "object" && value !== null) {
    const redacted: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      redacted[key] = SECRET_KEYS.some((secretKey) => key.toLowerCase().includes(secretKey))
        ? "[REDACTED]"
        : redact(nested);
    }

    return redacted;
  }

  return value;
}
