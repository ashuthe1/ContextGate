import type { RiskClass, Tool } from "../../core/src/index.js";

const DESTRUCTIVE = ["delete", "drop", "destroy", "remove", "terminate", "revoke", "reset", "disable"];
const EXTERNAL_WRITE = ["send", "publish", "post", "message", "email", "notify"];
const PRIVILEGED_INFRA = ["deploy", "restart", "scale", "run_command", "shell", "kubectl", "install"];
const MONETARY = ["refund", "charge", "payment", "invoice", "billing", "purchase"];
const CREDENTIAL = ["secret", "token", "password", "credential", "api key", "private key"];
const WRITE_SAFE = ["create", "update", "write", "edit", "merge", "transition", "comment"];
const READ = ["get", "list", "read", "search", "fetch", "describe", "query"];

export function classifyRisk(tool: Tool): RiskClass {
  const text = `${tool.serverId} ${tool.name} ${tool.title ?? ""} ${tool.description ?? ""}`.toLowerCase();

  if (matchesAny(text, CREDENTIAL)) {
    return "credential_access";
  }

  if (matchesAny(text, MONETARY)) {
    return "monetary";
  }

  if (matchesAny(text, DESTRUCTIVE)) {
    return "destructive";
  }

  if (matchesAny(text, PRIVILEGED_INFRA)) {
    return "privileged_infra";
  }

  if (matchesAny(text, EXTERNAL_WRITE)) {
    return "write_external";
  }

  if (matchesAny(text, WRITE_SAFE)) {
    return "write_safe";
  }

  if (matchesAny(text, READ)) {
    return "read";
  }

  return "unknown";
}

function matchesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}
