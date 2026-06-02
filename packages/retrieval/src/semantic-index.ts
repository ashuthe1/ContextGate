import type { CandidateTool, Tool } from "../../core/src/index.js";
import { summarizeToolForSearch } from "../../catalog/src/index.js";
import { tokenize } from "./tokenize.js";

interface SemanticConcept {
  id: string;
  phrases: string[];
}

const SEMANTIC_CONCEPTS: SemanticConcept[] = [
  { id: "issue", phrases: ["issue", "ticket", "bug", "bug report", "defect", "incident", "issue tracker"] },
  { id: "repository", phrases: ["repository", "repo", "codebase", "source control", "git", "version control"] },
  { id: "pull_request", phrases: ["pull request", "pr", "merge request", "code review", "review"] },
  { id: "file_read", phrases: ["read file", "inspect file", "look at file", "open file", "browse file"] },
  { id: "file_write", phrases: ["fix", "patch", "edit", "modify", "update", "change", "write file"] },
  { id: "comment", phrases: ["comment", "reply", "note", "feedback"] },
  { id: "search", phrases: ["search", "find", "lookup", "discover"] },
  { id: "message", phrases: ["message", "notify", "ping", "announce", "post"] },
  { id: "filesystem", phrases: ["filesystem", "local file", "workspace", "directory", "folder"] },
  { id: "database", phrases: ["database", "sql", "table", "row", "query"] },
  { id: "shell", phrases: ["shell", "terminal", "command", "cli", "script"] },
  { id: "deployment", phrases: ["deploy", "deployment", "rollout", "release", "ship", "restart"] },
  { id: "kubernetes", phrases: ["kubernetes", "k8s", "pod", "namespace", "cluster"] },
  { id: "billing", phrases: ["billing", "payment", "refund", "charge", "customer"] },
];

const SERVER_CONCEPTS: Partial<Record<string, string[]>> = {
  jira: ["issue", "search", "comment"],
  github: ["repository", "pull_request", "file_read", "file_write"],
  slack: ["message", "comment", "search"],
  filesystem: ["filesystem", "file_read", "file_write"],
  database: ["database", "search"],
  shell: ["shell", "file_write"],
  kubernetes: ["kubernetes", "deployment"],
  stripe: ["billing"],
};

export function retrieveSemanticTools(prompt: string, tools: Tool[]): CandidateTool[] {
  const promptConcepts = detectConcepts(prompt);

  return tools
    .map((tool) => scoreTool(tool, promptConcepts))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.id.localeCompare(b.tool.id));
}

function scoreTool(tool: Tool, promptConcepts: Set<string>): CandidateTool {
  const toolConcepts = new Set([
    ...detectConcepts(summarizeToolForSearch(tool)),
    ...(SERVER_CONCEPTS[tool.serverId] ?? []),
  ]);
  const overlap = [...promptConcepts].filter((concept) => toolConcepts.has(concept));
  const reasons: string[] = [];
  let score = 0;

  for (const concept of overlap) {
    score += concept === "pull_request" || concept === "issue" ? 0.16 : 0.11;
    reasons.push(`concept:${concept}`);
  }

  if (overlap.length > 0 && promptConcepts.has(tool.serverId)) {
    score += 0.08;
    reasons.push(`semantic_server:${tool.serverId}`);
  }

  if (promptConcepts.has("pull_request") && tool.serverId === "github") {
    if (["create_branch", "update_file", "create_pull_request", "read_file", "list_files"].includes(tool.name)) {
      score += 0.14;
      reasons.push("semantic_workflow:github_pr");
    }
  }

  if (promptConcepts.has("issue") && tool.serverId === "jira") {
    if (tool.name === "get_issue") {
      score += 0.14;
      reasons.push("semantic_workflow:jira_issue");
    } else if (tool.name === "search_issues") {
      score += 0.1;
      reasons.push("semantic_workflow:jira_search");
    }
  }

  if (promptConcepts.has("file_write") && /create|update|write|edit|patch/i.test(tool.name)) {
    score += 0.08;
    reasons.push("semantic_action:file_write");
  }

  return {
    tool,
    score: Math.min(score, 1),
    reasons: reasons.length > 0 ? reasons : ["weak semantic match"],
  };
}

function detectConcepts(text: string): Set<string> {
  const normalizedText = text.toLowerCase();
  const tokens = new Set(tokenize(text));
  const concepts = new Set<string>();

  for (const concept of SEMANTIC_CONCEPTS) {
    for (const phrase of concept.phrases) {
      if (phrase.includes(" ")) {
        if (normalizedText.includes(phrase)) {
          concepts.add(concept.id);
          break;
        }
      } else if (tokens.has(phrase) || tokens.has(singularize(phrase))) {
        concepts.add(concept.id);
        break;
      }
    }
  }

  for (const token of tokens) {
    concepts.add(singularize(token));
  }

  return concepts;
}

function singularize(token: string): string {
  if (token.endsWith("ies") && token.length > 3) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    return token.slice(0, -1);
  }

  return token;
}
