import type {
  CandidateTool,
  ContextGateConfig,
  SelectToolsInput,
  SelectToolsResult,
  Tool,
} from "../../core/src/index.js";
import { createId, hashText } from "../../core/src/index.js";
import { estimateToolSchemaTokens } from "../../catalog/src/index.js";
import { DefaultPolicyEngine } from "../../policy/src/index.js";
import type { PolicyDocument } from "../../core/src/index.js";
import { retrieveLexicalTools } from "./lexical-index.js";

export interface SelectionEngine {
  selectTools(input: SelectToolsInput): Promise<SelectToolsResult>;
}

export class DefaultSelectionEngine implements SelectionEngine {
  constructor(
    private readonly tools: Tool[],
    private readonly policyDocument: PolicyDocument,
    private readonly config: ContextGateConfig,
  ) {}

  async selectTools(input: SelectToolsInput): Promise<SelectToolsResult> {
    const maxTools = input.maxTools ?? this.policyDocument.selection.maxTools ?? this.config.selection.maxTools;
    const policyEngine = new DefaultPolicyEngine(this.policyDocument);
    const candidates = retrieveLexicalTools(input.prompt, this.tools)
      .map((candidate) => applyRiskPenalty(candidate, policyEngine))
      .sort((a, b) => b.score - a.score || a.tool.id.localeCompare(b.tool.id));

    const selected: SelectToolsResult["selected"] = [];
    const rejected: SelectToolsResult["rejected"] = [];

    const candidateIds = new Set(candidates.map((candidate) => candidate.tool.id));

    for (const candidate of candidates) {
      const exposure = policyEngine.evaluateExposure({
        tool: candidate.tool,
        score: candidate.score,
        reasons: candidate.reasons,
        prompt: input.prompt,
        userId: input.userId,
        projectId: input.projectId,
      });

      if (
        (exposure.decision === "selected" || exposure.decision === "selected_requires_approval") &&
        selected.length < maxTools
      ) {
        selected.push({
          tool: candidate.tool,
          score: candidate.score,
          mode: exposure.mode,
          riskClass: exposure.riskClass,
          requiresApproval: exposure.decision === "selected_requires_approval",
          reasons: exposure.reasons,
        });
        continue;
      }

      rejected.push({
        tool: candidate.tool,
        score: candidate.score,
        decision:
          exposure.decision === "selected" || exposure.decision === "selected_requires_approval"
            ? "not_relevant"
            : exposure.decision,
        reasons:
          selected.length >= maxTools && exposure.decision.startsWith("selected")
            ? [...exposure.reasons, `max tool limit ${maxTools} reached`]
            : exposure.reasons,
      });
    }

    for (const tool of this.tools) {
      if (candidateIds.has(tool.id)) {
        continue;
      }

      rejected.push({
        tool,
        decision: "not_relevant",
        reasons: ["no lexical match"],
      });
    }

    const selectedSchemaTokens = selected.reduce((sum, item) => sum + estimateToolSchemaTokens(item.tool), 0);
    const allSchemaTokens = this.tools.reduce((sum, tool) => sum + estimateToolSchemaTokens(tool), 0);

    return {
      taskId: createId("task"),
      capabilityId: input.dryRun ? undefined : createId("cap"),
      promptHash: hashText(input.prompt),
      totalTools: this.tools.length,
      candidates,
      selected,
      rejected,
      hiddenCount: rejected.filter((item) => item.decision === "hidden").length,
      blockedCount: rejected.filter((item) => item.decision === "blocked").length,
      notRelevantCount: rejected.filter((item) => item.decision === "not_relevant").length,
      estimatedSchemaTokensSaved: Math.max(0, allSchemaTokens - selectedSchemaTokens),
    };
  }
}

function applyRiskPenalty(candidate: CandidateTool, policyEngine: DefaultPolicyEngine): CandidateTool {
  const riskClass = policyEngine.resolveToolPolicy(candidate.tool).riskClass;
  const penalty = policyEngine.riskPenalty(riskClass);
  const score = Math.max(0, candidate.score - penalty);
  return {
    ...candidate,
    score,
    reasons: penalty > 0 ? [...candidate.reasons, `risk_penalty:${penalty}`] : candidate.reasons,
  };
}
