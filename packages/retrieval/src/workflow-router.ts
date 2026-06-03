import type { Tool } from "../../core/src/index.js";
import { tokenize } from "./tokenize.js";

interface WorkflowProfile {
  id: string;
  triggers: string[];
  preferredTools: string[];
  preferredServers?: string[];
}

const WORKFLOW_PROFILES: WorkflowProfile[] = [
  {
    id: "code_change_pr",
    triggers: ["pull request", "pr", "code review", "fix", "patch"],
    preferredServers: ["jira", "github"],
    preferredTools: [
      "jira.get_issue",
      "github.get_repository",
      "github.list_files",
      "github.read_file",
      "github.create_branch",
      "github.update_file",
      "github.create_pull_request",
    ],
  },
  {
    id: "incident_response",
    triggers: ["incident", "outage", "sev", "summary", "timeline", "investigate"],
    preferredServers: ["jira", "slack", "kubernetes"],
    preferredTools: ["jira.get_issue", "jira.search_issues", "slack.search_messages", "kubernetes.get_pods"],
  },
  {
    id: "readonly_research",
    triggers: ["research", "compare", "inspect", "analyze", "read only"],
    preferredServers: ["jira", "github", "filesystem"],
    preferredTools: ["jira.get_issue", "jira.search_issues", "github.read_file", "filesystem.read_file"],
  },
  {
    id: "workspace_edit",
    triggers: ["workspace", "local file", "directory", "folder", "edit locally"],
    preferredServers: ["filesystem", "shell"],
    preferredTools: ["filesystem.read_file", "filesystem.write_file", "filesystem.list_directory", "shell.run_command"],
  },
];

export function scoreWorkflowProfiles(prompt: string, tool: Tool): { bonus: number; reasons: string[] } {
  const lowered = prompt.toLowerCase();
  const tokens = new Set(tokenize(prompt));
  const reasons: string[] = [];
  let bonus = 0;

  for (const profile of WORKFLOW_PROFILES) {
    const matched = profile.triggers.some((trigger) =>
      trigger.includes(" ") ? lowered.includes(trigger) : tokens.has(trigger),
    );
    if (!matched) {
      continue;
    }

    if (profile.preferredTools.includes(tool.id)) {
      bonus += 0.3;
      reasons.push(`workflow_profile:${profile.id}`);
      continue;
    }

    if (profile.preferredServers?.includes(tool.serverId)) {
      bonus += 0.1;
      reasons.push(`workflow_server:${profile.id}`);
    }
  }

  return {
    bonus: Math.min(0.5, bonus),
    reasons: [...new Set(reasons)],
  };
}
