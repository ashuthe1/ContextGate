# ContextGate

ContextGate is a policy-aware MCP tool router. It prevents AI tools and agents from seeing every connected tool by default. Instead, it selects a small, task-relevant, policy-approved set of MCP tools for each user request.

Tagline:

Expose the right tools to the agent, not your entire stack.

## Problem

Modern AI tools can connect to many MCP servers: GitHub, Jira, Slack, databases, filesystems, browsers, cloud platforms, and internal APIs. Each server exposes tools through `tools/list`, and hosts often pass a large tool catalog into the model before the model needs most of it.

That creates four practical problems:

- Context bloat: tool schemas and descriptions consume prompt budget.
- Lower tool accuracy: irrelevant tools make selection noisier.
- Context poisoning risk: untrusted tool descriptions or outputs can influence model behavior.
- Permission risk: dangerous tools are visible even when the task does not need them.

ContextGate solves this by retrieving and exposing only the tools that are relevant for the current task and allowed by policy.

## Product Shape

ContextGate starts as a local-first developer tool:

- Connect multiple MCP servers.
- Index tool names, descriptions, schemas, annotations, and risk metadata.
- Retrieve relevant tools using semantic and lexical search.
- Filter tools through user/project policy.
- Expose only selected tools to the agent for the current task.
- Ask for approval before sensitive tool calls.
- Log selection, blocking, approval, and execution decisions.

The first version avoids building a full observability platform. It focuses on context control, least-privilege tool exposure, and policy enforcement.

## Documentation

- [Product Brief](docs/01-product-brief.md)
- [Technical Architecture](docs/02-technical-architecture.md)
- [Data Flow](docs/03-data-flow.md)
- [Policy Model](docs/04-policy-model.md)
- [Product Roadmap](docs/05-product-roadmap.md)
- [Proposed Project Structure](docs/06-project-structure.md)
- [Implementation ExecPlan](docs/EXECPLAN.md)

## Initial MVP

The MVP should prove one workflow:

1. A developer connects two or more MCP servers.
2. ContextGate indexes their tools.
3. The developer submits a task prompt.
4. ContextGate returns only the most relevant allowed tools.
5. The agent can call those tools through ContextGate.
6. A dangerous tool call requires explicit approval or is blocked.
7. The run is logged in local JSONL or SQLite.

## Current Milestone

The first runnable slice is implemented:

- `contextgate init` creates a starter `contextgate.yaml`.
- `contextgate index` indexes 30 deterministic mock MCP tools across GitHub, Jira, Slack, filesystem, database, shell, Kubernetes, and Stripe.
- `contextgate select "<prompt>"` returns a task-scoped tool set and writes local task/audit state.
- `contextgate policy test "<prompt>"` dry-runs selection and shows selected, hidden, and blocked tools.
- `contextgate call <task> <capability> <tool> <json>` executes a selected tool through the gateway.
- `contextgate serve` starts the local HTTP daemon.
- The daemon now serves a local operator console at `/ui` with integration health, task history, approval pressure, catalog browsing, and per-task timelines.
- `contextgate health` checks configured MCP servers and reports whether discovery succeeds.
- `contextgate expand <task-id> "<reason>"` adds more tools to an existing task when the first manifest was too narrow.
- `@contextgate/sdk` provides a TypeScript client for `selectTools`, `callTool`, task explanation, and health checks.
- `github.merge_pull_request` and other `ask` tools require explicit approval before execution.
- Configured `stdio` MCP servers are supported for discovery and execution through real MCP framing.
- Retrieval now uses a hybrid lexical plus lightweight semantic matcher, so prompts like "bug report" and "code review" map to Jira and GitHub PR workflows.
- Re-indexing now reports added, changed, removed, and unchanged tools so real integration drift is visible.
- Risk classification, policy filtering, retrieval, catalog persistence, and audit redaction have unit tests.

Run it locally:

    npm install
    npm test
    npm run cli -- init --force
    npm run cli -- index
    npm run cli -- health
    npm run cli -- policy test "Read Jira ticket PROJ-123, inspect the repo, and open a PR with a fix"

Execute a selected tool:

    npm run cli -- select "Read Jira ticket PROJ-123, inspect the repo, and open a PR with a fix"
    npm run cli -- call <task-id> <capability-id> jira.get_issue '{"key":"PROJ-123"}'
    npm run cli -- expand <task-id> "Need to add a comment back on the issue"

Use a real stdio MCP server:

```yaml
servers:
  local_docs:
    transport: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - /absolute/path/to/docs
    trust: user_configured
```

Run the sample API-level agent:

    npm run build
    npm run sample-agent

Start the local daemon:

    npm run build
    npm run daemon -- --port=3737

Then open the local console:

    http://127.0.0.1:3737/ui

Use the SDK from a custom agent:

```ts
import { ContextGate } from "@contextgate/sdk";

const gate = new ContextGate({ baseUrl: "http://127.0.0.1:3737" });
const selection = await gate.selectTools({
  prompt: "Check the bug report and open a code review with the patch",
  projectId: "demo",
});
const servers = await gate.serverHealth();
const expanded = await gate.expandTools(selection.taskId, "Need filesystem write access", 2);
```

The sample agent now uses the SDK end to end. It starts a local daemon unless `CONTEXTGATE_BASE_URL` is already set, then runs selection, an allowed tool call, a blocked guessed call, and a task explanation fetch.

The local console is backed by daemon routes for:

    GET /v1/server-health
    GET /v1/catalog
    GET /v1/tasks
    GET /v1/tasks/:taskId/explanation
    GET /v1/tasks/:taskId/timeline
    GET /v1/approvals

Try a real stdio MCP integration with the filesystem server:

    npm run cli -- index --config examples/configs/filesystem-stdio.yaml
    npm run cli -- policy test "Read the local README and inspect the docs folder" --config examples/configs/filesystem-stdio.yaml

The example config in `examples/configs/filesystem-stdio.yaml` uses:

    npx -y @modelcontextprotocol/server-filesystem .

That keeps the first real integration local and low-risk while exercising the same stdio MCP path used for other servers.

## References

The design follows the official MCP architecture and tool flow, where hosts create clients, clients connect to servers, servers expose tools, clients call `tools/list` for discovery, and clients call `tools/call` for execution:

- https://modelcontextprotocol.io/specification/2025-06-18/architecture
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
