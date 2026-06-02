import { redactSecrets } from "../../audit/src/index.js";

export function sanitizeToolResult<T>(result: T, options: { redactSecrets: boolean }): T {
  return options.redactSecrets ? redactSecrets(result) : result;
}
