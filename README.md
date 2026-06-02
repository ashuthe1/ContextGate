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
- Risk classification, policy filtering, retrieval, catalog persistence, and audit redaction have unit tests.

Run it locally:

    npm install
    npm test
    npm run cli -- init --force
    npm run cli -- index
    npm run cli -- policy test "Read Jira ticket PROJ-123, inspect the repo, and open a PR with a fix"

## References

The design follows the official MCP architecture and tool flow, where hosts create clients, clients connect to servers, servers expose tools, clients call `tools/list` for discovery, and clients call `tools/call` for execution:

- https://modelcontextprotocol.io/specification/2025-06-18/architecture
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
