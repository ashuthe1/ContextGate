import type { CandidateTool, Tool } from "../../core/src/index.js";
import { schemaPropertyNames, summarizeToolForSearch } from "../../catalog/src/index.js";
import { tokenize } from "./tokenize.js";

const DOMAIN_HINTS: Record<string, string[]> = {
  github: ["github", "repo", "repository", "branch", "pull", "pr", "file", "commit", "merge"],
  jira: ["jira", "issue", "ticket", "bug", "story", "project"],
  slack: ["slack", "message", "channel", "notify", "post"],
  filesystem: ["file", "directory", "folder", "workspace", "local"],
  database: ["database", "sql", "query", "table", "row"],
  shell: ["shell", "command", "terminal", "install", "run"],
  kubernetes: ["kubernetes", "k8s", "pod", "deployment", "namespace"],
  stripe: ["stripe", "refund", "payment", "customer", "billing"],
};

export function retrieveLexicalTools(prompt: string, tools: Tool[]): CandidateTool[] {
  const promptTokens = new Set(tokenize(prompt));

  return tools
    .map((tool) => scoreTool(tool, promptTokens))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.id.localeCompare(b.tool.id));
}

function scoreTool(tool: Tool, promptTokens: Set<string>): CandidateTool {
  const searchText = summarizeToolForSearch(tool);
  const toolTokens = new Set(tokenize(searchText));
  const reasons: string[] = [];
  let score = 0;

  for (const token of promptTokens) {
    if (toolTokens.has(token)) {
      score += 0.14;
      reasons.push(`token:${token}`);
    }
  }

  const domainHints = DOMAIN_HINTS[tool.serverId] ?? [];
  const matchedHints = domainHints.filter((hint) => promptTokens.has(hint));
  if (matchedHints.length > 0) {
    score += Math.min(0.16, matchedHints.length * 0.04);
    reasons.push(`server:${tool.serverId}`);
  }

  const workflowBonus = scoreWorkflow(tool, promptTokens);
  if (workflowBonus > 0) {
    score += workflowBonus;
    reasons.push("workflow_hint");
  }

  for (const propName of schemaPropertyNames(tool.inputSchema)) {
    if (promptTokens.has(propName.toLowerCase())) {
      score += 0.06;
      reasons.push(`schema:${propName}`);
    }
  }

  const normalizedName = tool.name.replaceAll("_", " ");
  if (promptIncludesPhrase(promptTokens, normalizedName)) {
    score += 0.2;
    reasons.push(`name:${tool.name}`);
  }

  return {
    tool,
    score: Math.min(score, 1),
    reasons: reasons.length > 0 ? [...new Set(reasons)] : ["weak lexical match"],
  };
}

function promptIncludesPhrase(promptTokens: Set<string>, phrase: string): boolean {
  return tokenize(phrase).every((token) => promptTokens.has(token));
}

function scoreWorkflow(tool: Tool, promptTokens: Set<string>): number {
  if (
    tool.serverId === "github" &&
    (promptTokens.has("pr") || promptIncludesPhrase(promptTokens, "pull request"))
  ) {
    if (
      [
        "get_repository",
        "list_files",
        "read_file",
        "create_branch",
        "update_file",
        "create_pull_request",
      ].includes(tool.name)
    ) {
      return 0.3;
    }
  }

  if (tool.serverId === "jira" && (promptTokens.has("jira") || promptTokens.has("ticket"))) {
    if (tool.name === "get_issue") {
      return 0.3;
    }

    if (tool.name === "search_issues") {
      return 0.2;
    }

    if (tool.name === "add_comment" && promptTokens.has("comment")) {
      return 0.2;
    }
  }

  return 0;
}
