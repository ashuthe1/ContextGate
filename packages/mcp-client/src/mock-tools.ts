import type { McpToolDefinition } from "../../core/src/index.js";

export const MOCK_TOOLS_BY_SERVER: Record<string, McpToolDefinition[]> = {
  jira: [
    tool("get_issue", "Get Jira issue", "Fetch a Jira issue by key.", {
      key: stringProp("Jira issue key, such as PROJ-123"),
    }),
    tool("search_issues", "Search Jira issues", "Search Jira issues by JQL or keywords.", {
      query: stringProp("JQL query or search text"),
    }),
    tool("add_comment", "Add Jira comment", "Add a comment to a Jira issue.", {
      key: stringProp("Jira issue key"),
      body: stringProp("Comment body"),
    }),
    tool("transition_issue", "Transition Jira issue", "Move a Jira issue to a new workflow state.", {
      key: stringProp("Jira issue key"),
      status: stringProp("Target status"),
    }),
  ],
  github: [
    tool("get_repository", "Get repository", "Read GitHub repository metadata.", {
      repo: stringProp("Repository owner/name"),
    }),
    tool("list_files", "List repository files", "List files in a GitHub repository path.", {
      repo: stringProp("Repository owner/name"),
      path: stringProp("Repository path"),
    }),
    tool("read_file", "Read file", "Read a file from a GitHub repository.", {
      repo: stringProp("Repository owner/name"),
      path: stringProp("File path"),
      ref: stringProp("Branch, tag, or commit"),
    }),
    tool("create_branch", "Create branch", "Create a GitHub branch.", {
      repo: stringProp("Repository owner/name"),
      branch: stringProp("New branch name"),
      from: stringProp("Base branch or commit"),
    }),
    tool("update_file", "Update file", "Create or update a file in a GitHub repository.", {
      repo: stringProp("Repository owner/name"),
      path: stringProp("File path"),
      branch: stringProp("Branch name"),
      content: stringProp("New file content"),
      message: stringProp("Commit message"),
    }),
    tool("create_pull_request", "Create pull request", "Open a GitHub pull request.", {
      repo: stringProp("Repository owner/name"),
      title: stringProp("Pull request title"),
      head: stringProp("Source branch"),
      base: stringProp("Target branch"),
      body: stringProp("Pull request description"),
    }),
    tool("merge_pull_request", "Merge pull request", "Merge a GitHub pull request.", {
      repo: stringProp("Repository owner/name"),
      number: numberProp("Pull request number"),
    }),
    tool("delete_branch", "Delete branch", "Delete a branch from a GitHub repository.", {
      repo: stringProp("Repository owner/name"),
      branch: stringProp("Branch to delete"),
    }),
    tool("delete_repository", "Delete repository", "Permanently delete a GitHub repository.", {
      repo: stringProp("Repository owner/name"),
    }),
  ],
  slack: [
    tool("search_messages", "Search Slack messages", "Search Slack messages in visible channels.", {
      query: stringProp("Search query"),
    }),
    tool("send_message", "Send Slack message", "Send a message to a Slack channel.", {
      channel: stringProp("Slack channel name"),
      text: stringProp("Message text"),
    }),
    tool("create_channel", "Create Slack channel", "Create a Slack channel.", {
      name: stringProp("Channel name"),
    }),
  ],
  filesystem: [
    tool("read_file", "Read local file", "Read a file from an allowed local workspace root.", {
      path: stringProp("Local file path"),
    }),
    tool("write_file", "Write local file", "Write a file under an allowed local workspace root.", {
      path: stringProp("Local file path"),
      content: stringProp("File content"),
    }),
    tool("list_directory", "List directory", "List files under an allowed local workspace root.", {
      path: stringProp("Directory path"),
    }),
    tool("delete_file", "Delete local file", "Delete a file from the local filesystem.", {
      path: stringProp("Local file path"),
    }),
  ],
  database: [
    tool("run_read_query", "Run read SQL query", "Run a read-only SQL query.", {
      sql: stringProp("Read-only SQL query"),
    }),
    tool("run_write_query", "Run write SQL query", "Run a SQL query that changes database rows.", {
      sql: stringProp("Write SQL query"),
    }),
    tool("drop_table", "Drop database table", "Drop a database table.", {
      table: stringProp("Table name"),
    }),
  ],
  shell: [
    tool("run_command", "Run shell command", "Run a shell command in the local workspace.", {
      command: stringProp("Shell command"),
      cwd: stringProp("Working directory"),
    }),
    tool("install_package", "Install package", "Install a package using the project package manager.", {
      name: stringProp("Package name"),
      manager: stringProp("Package manager"),
    }),
  ],
  kubernetes: [
    tool("get_pods", "Get pods", "List Kubernetes pods in a namespace.", {
      namespace: stringProp("Kubernetes namespace"),
    }),
    tool("restart_deployment", "Restart deployment", "Restart a Kubernetes deployment.", {
      namespace: stringProp("Kubernetes namespace"),
      deployment: stringProp("Deployment name"),
    }),
    tool("delete_deployment", "Delete deployment", "Delete a Kubernetes deployment.", {
      namespace: stringProp("Kubernetes namespace"),
      deployment: stringProp("Deployment name"),
    }),
  ],
  stripe: [
    tool("get_customer", "Get Stripe customer", "Read Stripe customer details.", {
      customerId: stringProp("Stripe customer id"),
    }),
    tool("refund_payment", "Refund payment", "Issue a payment refund.", {
      paymentIntentId: stringProp("Payment intent id"),
      amount: numberProp("Refund amount in cents"),
    }),
  ],
};

function tool(
  name: string,
  title: string,
  description: string,
  properties: Record<string, { type: string; description: string }>,
): McpToolDefinition {
  return {
    name,
    title,
    description,
    inputSchema: {
      type: "object",
      properties,
      required: Object.keys(properties),
    },
  };
}

function stringProp(description: string): { type: string; description: string } {
  return { type: "string", description };
}

function numberProp(description: string): { type: string; description: string } {
  return { type: "number", description };
}
