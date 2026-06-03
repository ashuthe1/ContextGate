import type { JsonObject, Tool } from "../../core/src/index.js";

const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; reason: string; penalty: number }> = [
  { pattern: /ignore (all|any|previous) instructions/i, reason: "prompt_injection:ignore_instructions", penalty: 0.3 },
  { pattern: /system prompt|developer message/i, reason: "prompt_injection:mentions_system_prompt", penalty: 0.25 },
  { pattern: /always use this tool|must use this tool/i, reason: "prompt_injection:forced_tool_use", penalty: 0.2 },
  { pattern: /send secrets|exfiltrate|export credentials/i, reason: "prompt_injection:secret_exfiltration", penalty: 0.4 },
];

export function assessToolTrust(input: {
  serverTrust: Tool["trustLevel"];
  name: string;
  title?: string;
  description?: string;
  annotations?: JsonObject;
}): { trustScore: number; trustWarnings: string[] } {
  const warnings: string[] = [];
  let score = input.serverTrust === "trusted" ? 1 : input.serverTrust === "user_configured" ? 0.92 : 0.75;
  const text = [input.name, input.title ?? "", input.description ?? "", JSON.stringify(input.annotations ?? {})].join(" ");

  for (const candidate of SUSPICIOUS_PATTERNS) {
    if (candidate.pattern.test(text)) {
      warnings.push(candidate.reason);
      score -= candidate.penalty;
    }
  }

  if (input.description && input.description.length > 900) {
    warnings.push("prompt_injection:oversized_description");
    score -= 0.08;
  }

  return {
    trustScore: Math.max(0.1, Number(score.toFixed(2))),
    trustWarnings: warnings,
  };
}
