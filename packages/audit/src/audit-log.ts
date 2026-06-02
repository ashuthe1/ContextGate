import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuditEvent } from "../../core/src/index.js";
import { redactSecrets } from "./redaction.js";

export interface AuditLog {
  write(event: AuditEvent): Promise<void>;
}

export class JsonlAuditLog implements AuditLog {
  constructor(
    private readonly path: string,
    private readonly options: { redactSecrets: boolean },
  ) {}

  async write(event: AuditEvent): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const payload = this.options.redactSecrets ? redactSecrets(event) : event;
    await appendFile(this.path, `${JSON.stringify(payload)}\n`);
  }
}
