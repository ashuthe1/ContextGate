import { redactSecrets } from "../../audit/src/index.js";

const OUTPUT_RISK_PATTERNS: Array<{ pattern: RegExp; warning: string; replacement?: string; penalty: number }> = [
  {
    pattern: /ignore (all|any|previous) instructions/gi,
    warning: "output_trust:ignore_instructions",
    replacement: "[FILTERED_INSTRUCTION]",
    penalty: 0.28,
  },
  {
    pattern: /system prompt|developer message/gi,
    warning: "output_trust:mentions_system_prompt",
    replacement: "[FILTERED_META_PROMPT]",
    penalty: 0.22,
  },
  {
    pattern: /always use this tool|must use this tool/gi,
    warning: "output_trust:forced_tool_use",
    replacement: "[FILTERED_TOOL_DIRECTIVE]",
    penalty: 0.18,
  },
  {
    pattern: /send secrets|exfiltrate|export credentials/gi,
    warning: "output_trust:secret_exfiltration",
    replacement: "[FILTERED_SECRET_DIRECTIVE]",
    penalty: 0.4,
  },
];

export function sanitizeToolResult<T>(
  result: T,
  options: { redactSecrets: boolean },
): { result: T; outputWarnings: string[]; outputTrustScore: number } {
  const redacted = options.redactSecrets ? redactSecrets(result) : result;
  const warnings = new Set<string>();
  let trustScore = 1;
  const sanitized = scan(redacted, warnings, (penalty) => {
    trustScore -= penalty;
  }) as T;

  return {
    result: sanitized,
    outputWarnings: [...warnings],
    outputTrustScore: Math.max(0.1, Number(trustScore.toFixed(2))),
  };
}

function scan(
  value: unknown,
  warnings: Set<string>,
  applyPenalty: (penalty: number) => void,
): unknown {
  if (typeof value === "string") {
    let next = value;
    for (const candidate of OUTPUT_RISK_PATTERNS) {
      if (candidate.pattern.test(next)) {
        warnings.add(candidate.warning);
        applyPenalty(candidate.penalty);
        if (candidate.replacement) {
          next = next.replace(candidate.pattern, candidate.replacement);
        }
      }
    }
    return next;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scan(item, warnings, applyPenalty));
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = scan(nested, warnings, applyPenalty);
    }
    return result;
  }

  return value;
}
