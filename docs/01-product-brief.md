# Product Brief: ContextGate

## One-Line Pitch

ContextGate is a local-first MCP gateway that gives AI agents only the task-relevant tools they are allowed to use.

## Why This Should Exist

AI agents are becoming more useful because they can operate real tools: GitHub, Jira, Slack, databases, file systems, deployment systems, billing APIs, and internal services. MCP gives these tools a common protocol surface, but connecting many MCP servers creates a new problem: the model sees too much.

In many current setups, every available tool schema is made visible to the model before the model knows what it needs. That can waste context, increase cost, confuse tool selection, and expose dangerous actions to prompts that never needed them. It also expands the attack surface for context poisoning, where malicious or low-quality tool descriptions and outputs influence the model.

ContextGate treats tool access as a retrieval and authorization problem. For each task, it selects a narrow, least-privilege tool set and enforces policy outside the model.

## Target Users

The first users should be technical builders already experimenting with AI tools and MCP:

- Indie hackers building agent-powered SaaS products.
- Developers using MCP with coding agents.
- Teams connecting internal tools to agents.
- Security-conscious engineers who want agents to have less ambient authority.
- MCP server authors who want safer adoption of their tools.

The first target niche should be "safe MCP access for coding and product-engineering agents." This niche has obvious tool sprawl: GitHub, local filesystem, shell, Jira, Slack, browser, package managers, and cloud/devops APIs.

## Core User Pain

The user wants to say:

    "I want my AI agent connected to GitHub, Jira, Slack, and my local project, but I do not want to dump 200 tools into the model context or let it freely call destructive tools."

ContextGate lets that user connect the tools once, then expose only a small task-scoped set per prompt.

## Jobs To Be Done

When a developer starts an agent task, they want ContextGate to:

1. Understand the user's task well enough to find relevant tools.
2. Hide unrelated tools from the model.
3. Apply explicit user/team policy before any tool is exposed or executed.
4. Ask for approval before high-risk actions.
5. Log why each tool was exposed, hidden, blocked, or approved.
6. Keep tool exposure small enough to reduce context usage and improve model focus.

## Product Principles

Least privilege by default. The agent should see only tools it needs for the task.

Policy outside the model. Dangerous tools should not be controlled only by prompt instructions.

Local first. Developers should be able to run ContextGate without sending internal tool catalogs or prompts to a hosted service.

Compositional. ContextGate should sit in front of existing MCP servers instead of requiring users to rewrite them.

Transparent. The user should be able to inspect why a tool was selected, hidden, blocked, or approved.

Small first version. The MVP should be a CLI and local service, not a complex hosted platform.

## Differentiation

Generic LLM observability tools answer:

    "What happened during this agent run?"

ContextGate answers:

    "Which tools should the agent be allowed to know about and use for this task?"

That makes it different from tracing-first products. ContextGate may later export traces to observability tools, but its core value is tool selection, context reduction, permissioning, and task-scoped capability control.

## User-Facing Features

### Tool Catalog

ContextGate connects to configured MCP servers and builds a local catalog of tools. Each record includes server name, tool name, title, description, input schema, output schema, annotations, risk class, policy mode, and embedding metadata.

### Task-Scoped Tool Selection

Given a user prompt, ContextGate retrieves a short list of likely relevant tools. It combines semantic search, keyword search, server hints, policy filters, risk penalties, and optional workflow templates.

### Policy Enforcement

Users can configure per-tool and per-server policy:

- Allow automatically.
- Ask before executing.
- Deny execution.
- Hide from model context entirely.
- Restrict by resource, such as repository, Slack channel, database, namespace, branch, or file path.

### Approval Flow

For sensitive tools, ContextGate pauses execution and asks the user to approve or deny. The approval request shows the tool, arguments, risk class, resource being touched, and reason the tool was selected.

### Audit Log

Every selection and execution decision is logged locally:

- User prompt hash and optional plaintext prompt if enabled.
- Candidate tools.
- Selected tools.
- Hidden and blocked tools.
- Tool call arguments.
- Approval decisions.
- Tool results metadata.
- Errors and latency.

### Context Budgeting

ContextGate enforces a maximum number of exposed tools and a maximum schema token budget. If a tool schema is too large, it can summarize safe metadata first and lazily provide full schema when the tool is selected.

## Non-Goals For MVP

The MVP should not attempt to:

- Build a full hosted SaaS dashboard.
- Replace existing LLM observability products.
- Support every MCP transport perfectly.
- Automatically classify every possible tool with perfect security.
- Guarantee protection against all prompt injection attacks.
- Build a marketplace of MCP servers.

The MVP should prove that task-scoped tool retrieval plus policy filtering improves safety and context efficiency.

## Success Metrics

Useful MVP metrics:

- Tool reduction ratio: average number of available tools versus exposed tools.
- Context reduction: estimated tokens saved per task.
- Selection precision: percentage of selected tools actually used by the agent.
- Missing-tool rate: percentage of runs where the needed tool was hidden and the user had to retry.
- Block rate: number of denied or approval-required calls.
- Time to configure: minutes from install to first routed agent task.

## Example User Story

A developer connects GitHub, Jira, Slack, filesystem, and shell MCP servers. Those servers expose 140 tools. The user asks:

    "Read Jira ticket PROJ-123, inspect the repo, and open a PR with a fix."

ContextGate exposes 9 tools:

- jira.get_issue
- github.get_repository
- github.list_files
- github.read_file
- github.create_branch
- github.update_file
- github.create_pull_request
- filesystem.read_file
- filesystem.write_file

It hides or blocks unrelated and risky tools:

- github.delete_branch
- github.delete_repository
- slack.send_message
- shell.run_command
- database.run_write_query

If the agent later tries to call `github.delete_branch`, ContextGate rejects the call because that tool was not part of the task capability set.
