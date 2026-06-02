# Build ContextGate MVP

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with the ExecPlan requirements and guidelines in the `execution-plan` skill.

## Purpose / Big Picture

ContextGate is a local-first MCP tool router. After the MVP exists, a developer can connect multiple MCP servers, index their tools, submit a task prompt, and receive only the task-relevant tools allowed by policy. The developer can then route tool calls through ContextGate so hidden or denied tools cannot execute and sensitive tools require approval.

The visible proof of success is a demo where a mock catalog has many tools, a prompt selects a small subset, and an attempted dangerous tool call is blocked or requires approval.

## Progress

- [x] (2026-06-03) Chose product name `ContextGate` and narrowed scope to policy-aware MCP tool routing rather than generic agent observability.
- [x] (2026-06-03) Created product and technical design documents under `indie-hack/contextgate/docs`.
- [x] (2026-06-03) Bootstrapped an npm workspace TypeScript monorepo.
- [x] (2026-06-03) Implemented deterministic mock MCP tool catalogs with safe, risky, and irrelevant tools across GitHub, Jira, Slack, filesystem, database, shell, Kubernetes, and Stripe.
- [x] (2026-06-03) Implemented mock tool discovery and atomic catalog storage.
- [x] (2026-06-03) Implemented lexical retrieval, workflow hints, risk classification, policy loading, exposure decisions, audit redaction, and JSONL audit logging.
- [x] (2026-06-03) Implemented CLI commands for init, index, select, and policy test.
- [x] (2026-06-03) Added unit tests and smoke-tested the compiled CLI.
- [x] (2026-06-03) Implemented local daemon request handling and HTTP server entrypoint.
- [x] (2026-06-03) Implemented execution gateway with task capability checks, argument validation, execution policy checks, mock tool routing, result redaction, and audit events.
- [x] (2026-06-03) Implemented CLI `call` command with terminal approval flow and `serve` command for the daemon.
- [x] (2026-06-03) Implemented end-to-end sample agent demo.
- [x] (2026-06-03) Added real MCP stdio transport support.
- [x] (2026-06-03) Added SDK package wrapper around daemon APIs.
- [x] (2026-06-03) Added hybrid semantic tool retrieval.

## Surprises & Discoveries

- Observation: The official MCP tool flow already recommends human confirmation for sensitive operations and audit logging, but MCP itself does not decide how a host should reduce the tool list per task.
  Evidence: The MCP tools specification describes `tools/list` and `tools/call`, and places security responsibilities such as confirmation, validation, timeouts, and audit logging on clients and applications.

- Observation: `pnpm` was not installed in the local environment, while `npm` was available.
  Evidence: `pnpm --version` returned `command not found`; `npm --version` returned `10.9.3`.

- Observation: The first risk classifier incorrectly treated ordinary Jira "issue key" text as credential access because it matched the word `key`.
  Evidence: `jira.get_issue` was penalized as `credential_access` and fell out of the selected tool set until the heuristic was tightened to match `api key` and `private key` instead.

- Observation: Parallel CLI smoke commands exposed a partial-read catalog bug.
  Evidence: running `index` and `policy test` concurrently once produced `Catalog file is invalid JSON: Unexpected end of JSON input`; catalog writes now use a temporary file followed by atomic rename.

- Observation: The local sandbox does not allow opening a listening HTTP socket without escalation.
  Evidence: a daemon health test that called `server.listen()` failed with `listen EPERM: operation not permitted 127.0.0.1`; the daemon test now exercises the request handler directly, and real daemon smoke testing needs an escalated command.

## Decision Log

- Decision: Start with a local-first CLI and daemon instead of a hosted SaaS.
  Rationale: The first value proposition involves developer trust, local tools, and internal tool metadata. A local product is easier to adopt and avoids premature platform complexity.
  Date/Author: 2026-06-03 / Codex

- Decision: Use TypeScript for the MVP.
  Rationale: The product needs fast iteration around JSON schemas, MCP messages, CLI behavior, and developer SDKs. TypeScript is also practical for npm distribution.
  Date/Author: 2026-06-03 / Codex

- Decision: Use npm workspaces for the first implementation instead of pnpm workspaces.
  Rationale: pnpm was not installed locally, while npm was available and sufficient for the MVP. This keeps implementation moving without changing the package layout in a meaningful way.
  Date/Author: 2026-06-03 / Codex

- Decision: Enforce policy at both exposure time and execution time.
  Rationale: Hiding a tool from the model is not enough because a model could guess or hallucinate a tool name. Execution-time checks prevent hidden and denied tools from running.
  Date/Author: 2026-06-03 / Codex

- Decision: Implement lexical retrieval first, then add semantic retrieval.
  Rationale: A lexical baseline can prove the workflow without requiring embedding dependencies or vector database choices. Semantic retrieval can be added behind the same interface later.
  Date/Author: 2026-06-03 / Codex

- Decision: Implement the first mock MCP layer as deterministic in-process tool catalogs rather than a JSON-RPC mock server.
  Rationale: The first milestone needs to validate routing, policy, ranking, and CLI behavior. A real JSON-RPC mock server is more useful in the execution-gateway milestone when `tools/call` is implemented.
  Date/Author: 2026-06-03 / Codex

- Decision: Default the coding-agent selection budget to 8 tools.
  Rationale: A 12-tool default let weakly related tools into the first demo. Eight keeps the task manifest focused while still enough for the Jira-to-GitHub PR workflow.
  Date/Author: 2026-06-03 / Codex

- Decision: Make task capabilities explicit files under `.contextgate/capabilities`.
  Rationale: A selected tool list is not enough for execution. Persisted capability records give the gateway an enforceable boundary: only tools selected for the task can be called.
  Date/Author: 2026-06-03 / Codex

- Decision: Return `approval_required` from the daemon instead of prompting inside the HTTP request.
  Rationale: HTTP clients and future UIs need a resumable approval flow. The CLI can prompt interactively, while API clients can resubmit with an approval payload.
  Date/Author: 2026-06-03 / Codex

## Outcomes & Retrospective

Milestone 1 is complete. The repo now has a runnable CLI that can initialize config, index 30 mock MCP tools, select 8 task-relevant tools for a Jira-to-GitHub PR workflow, show blocked dangerous tools for destructive prompts, and write local audit/task state. Typecheck, unit tests, build, and compiled CLI smoke tests pass. The remaining major gap is execution: selected tools are not yet callable through a policy-enforcing gateway.

Milestone 2 is complete. The repo now has a policy-enforcing execution gateway. `contextgate select` creates a persisted task and capability, `contextgate call` executes selected allowed tools, guessed tools outside the capability are blocked, missing required arguments are rejected, and `ask` tools return `approval_required` until approved. A built-in HTTP daemon exposes health, tool selection, tool call, and task explanation routes. The sample agent proves the end-to-end flow without a real LLM.

The next milestone follow-up is complete for stdio MCP servers. The connector manager can now spawn configured stdio servers, initialize them over MCP framing, discover tools with `tools/list`, and execute calls with `tools/call`. Config now supports per-server `command`, `args`, `cwd`, and `env`, and the transport is covered by an end-to-end process test using a framed stdio fixture.

The SDK and retrieval follow-ups are also complete. `@contextgate/sdk` now wraps the daemon health, selection, tool-call, and task-explanation APIs for SDK mode integrations. Retrieval now combines lexical matches with lightweight semantic concept expansion so prompts like "bug report", "issue tracker", and "code review" still pull the expected Jira and GitHub workflow tools without introducing embedding dependencies yet.

## Context and Orientation

The current repository area is `indie-hack/contextgate`. It currently contains documentation only. The intended implementation should be a TypeScript monorepo with apps and packages.

MCP means Model Context Protocol. In MCP, a host is the AI application, a client is the component that connects to one MCP server, and a server exposes capabilities such as tools. Tools are discovered with a JSON-RPC request named `tools/list` and executed with a JSON-RPC request named `tools/call`.

ContextGate acts as a gateway between the AI host and downstream MCP servers. It discovers the full tool catalog, but only exposes a small task-scoped manifest to the model. A task-scoped manifest is the list of tools selected for one user prompt. A capability is the permission object that records which tools are allowed for that task and when that permission expires.

The MVP should support a mock MCP server first. A mock MCP server is a local test server that behaves like a real MCP server but exposes predictable fake tools. This makes testing deterministic before integrating GitHub, Slack, Jira, or filesystem MCP servers.

## Plan of Work

First, create the monorepo structure described in `docs/06-project-structure.md`. Add root package metadata, TypeScript config, npm workspace configuration, and package directories. Keep each package small and library-first so the CLI and daemon call shared logic.

Next, implement shared types in `packages/core/src/types.ts`. Define `Tool`, `Task`, `ToolSelection`, `Capability`, `ToolCall`, `RiskClass`, `PolicyMode`, `ExposureDecision`, and `ExecutionDecision`. Add id helpers in `packages/core/src/ids.ts` and typed errors in `packages/core/src/errors.ts`.

Then implement config loading in `packages/core/src/config.ts`. The config loader should read `contextgate.yaml`, validate basic shape, and return server, policy, selection, and audit settings. For the first version, use a schema validation library if already installed; otherwise write explicit validation functions that produce clear errors.

After that, implement `examples/mock-mcp-server`. It should expose at least 20 tools across several fake domains: GitHub, Jira, Slack, database, shell, and filesystem. Include read-only tools, safe write tools, destructive tools, and irrelevant tools. This server is the backbone of tests.

Implement MCP discovery in `packages/mcp-client`. The connector manager should connect to the mock server, call `tools/list`, and return normalized raw tool definitions. If a full MCP SDK is used, wrap it behind local interfaces so the rest of the codebase does not depend on SDK details.

Implement the catalog package. `tool-normalizer.ts` should convert raw MCP tool definitions into ContextGate `Tool` records with stable ids. `tool-hasher.ts` should compute a deterministic hash from tool metadata so changed tools can be detected. `catalog-store.ts` can initially write JSON files under `.contextgate/catalog.json`.

Implement retrieval in `packages/retrieval`. Start with lexical scoring over server id, tool name, title, description, and schema property names. The retrieval interface must not expose lexical-specific types so semantic retrieval can replace or augment it later. The scorer should return candidate tools with scores and reason strings.

Implement policy in `packages/policy`. The policy loader should parse the policy section or a referenced policy file. The risk classifier should assign risk using explicit policy first, then heuristics such as tool names containing delete, drop, revoke, refund, send, write, create, update, deploy, restart, secret, token, or password. The policy engine should implement exposure and execution checks.

Implement the CLI in `apps/cli`. `contextgate init` should create a sample `contextgate.yaml`. `contextgate index` should discover and catalog tools. `contextgate select "<prompt>"` should retrieve candidates, apply policy, enforce the max tool limit, create a task record, and print selected/hidden/blocked tools. `contextgate policy test` should run the same logic without creating an executable capability.

Implement the daemon in `apps/daemon`. It should expose `GET /health`, `POST /v1/tool-selection`, `POST /v1/tool-call`, and `GET /v1/tasks/:taskId/explanation`. The daemon should call the same core packages as the CLI. The first version can keep state on disk in `.contextgate`.

Implement the gateway in `packages/gateway`. It should create capabilities, verify that a tool call belongs to a task capability, validate arguments against the tool input schema, evaluate execution policy, request approval when needed, proxy allowed calls to the downstream mock MCP server, sanitize results if configured, and write audit events.

Implement audit logging in `packages/audit`. Start with JSONL. Every event should include timestamp, event type, task id when available, tool id when available, decision, and reason strings. Redact common secret fields.

Finally, build `examples/sample-agent`. It does not need to use a real LLM at first. It can simulate an agent by asking ContextGate for tools, calling an allowed tool, and then attempting to call a denied dangerous tool. This proves the gateway works without nondeterministic model behavior.

## Concrete Steps

Run all commands from:

    /Users/ashugaut/Learnings/Projects/indie-hack/contextgate

Bootstrap:

    npm install

Workspace files now exist:

    package.json workspaces
    tsconfig.base.json
    apps/cli/package.json
    apps/daemon/package.json
    packages/core/package.json
    packages/mcp-client/package.json
    packages/catalog/package.json
    packages/retrieval/package.json
    packages/policy/package.json
    packages/gateway/package.json
    packages/audit/package.json
    packages/sdk/package.json

Add root scripts:

    npm run build
    npm run typecheck
    npm test
    npm run cli -- <command>

Expected first useful command after implementation:

    npm run cli -- policy test "Read Jira ticket PROJ-123, inspect the repo, and open a PR with a fix"

Expected output shape:

    Catalog tools: 30
    Candidate tools: 13
    Selected tools: 8
    Hidden by policy: 0
    Blocked by policy: 0
    Estimated schema tokens saved: 1487

    Selected:
      github.create_pull_request     allow
      github.get_repository          allow
      github.list_files              allow
      github.read_file               allow
      github.create_branch           allow
      github.update_file             allow
      jira.get_issue                 allow
      jira.search_issues             allow

Dangerous prompt smoke test:

    npm run cli -- policy test "Delete the old GitHub repository and drop the stale database table"

Expected blocked tools:

    database.drop_table              blocked
    github.delete_repository         blocked

Gateway execution smoke test:

    npm run cli -- select "Read Jira ticket PROJ-123, inspect the repo, and open a PR with a fix"
    npm run cli -- call <task-id> <capability-id> jira.get_issue '{"key":"PROJ-123"}'

Expected result:

    "decision": "allowed"
    "text": "Mock result for jira.get_issue"

Guessed dangerous tool smoke test:

    npm run cli -- call <task-id> <capability-id> github.delete_repository '{"repo":"ash/contextgate"}' --no-prompt

Expected result:

    "decision": "blocked"
    "tool is not part of this task capability"

Approval smoke test:

    npm run cli -- select "Merge GitHub pull request 42 in repo ash/contextgate"
    npm run cli -- call <task-id> <capability-id> github.merge_pull_request '{"repo":"ash/contextgate","number":42}' --no-prompt
    npm run cli -- call <task-id> <capability-id> github.merge_pull_request '{"repo":"ash/contextgate","number":42}' --yes

Expected results:

    "decision": "approval_required"
    "decision": "allowed"

## Validation and Acceptance

The MVP is accepted when these behaviors work:

1. `contextgate index` connects to the mock MCP server and writes a local catalog containing at least 20 tools.
2. `contextgate select "Read Jira ticket PROJ-123 and open a PR"` returns fewer than 12 selected tools and includes Jira/GitHub tools.
3. The same selection hides or blocks destructive tools such as delete repository and drop table.
4. `contextgate select` returns a task id, capability id, selected tools, and reasons.
5. JSONL audit logs include selection decisions.
6. `npm test` passes unit tests.
7. `npm run typecheck` passes.
8. `npm run build` passes.

The gateway milestone added:

1. `POST /v1/tool-selection` returns a task id, capability id, selected tools, and reasons.
2. `POST /v1/tool-call` allows a selected read tool.
3. `POST /v1/tool-call` blocks a hidden or denied tool even if the caller guesses the tool id.
4. A configured `ask` tool produces an approval request before execution.

Suggested tests:

- `policy-engine.test.ts` verifies precedence: explicit tool policy wins over server default.
- `risk-classifier.test.ts` verifies destructive verbs classify as destructive.
- `selection-engine.test.ts` verifies relevant GitHub/Jira tools rank above Slack/database tools for a PR task.
- `execution-gateway.test.ts` verifies denied hidden tools cannot execute.
- `redaction.test.ts` verifies API keys and authorization headers are redacted.
- `execution-gateway.test.ts` verifies selected tools execute, guessed tools are blocked, required arguments are validated, and ask-mode tools require approval before execution.
- `server.test.ts` verifies daemon health handling without opening a socket, because the local sandbox blocks listen calls.

## Idempotence and Recovery

All generated local state should live under `.contextgate`. Deleting `.contextgate` should reset the local catalog, tasks, capabilities, and audit logs without touching source code.

`contextgate index` should be safe to rerun. It uses atomic catalog writes so readers do not observe partially written JSON. It should update changed tools, preserve unchanged tool records, and mark missing tools as unavailable rather than immediately deleting them.

If a downstream MCP server fails during indexing, ContextGate should log the error and continue indexing other servers. The command should exit nonzero only if every configured server fails or the config is invalid.

If a policy file is invalid, ContextGate should refuse to start and print the exact path and rule that failed validation.

## Artifacts and Notes

The current design documents are:

    README.md
    docs/01-product-brief.md
    docs/02-technical-architecture.md
    docs/03-data-flow.md
    docs/04-policy-model.md
    docs/05-product-roadmap.md
    docs/06-project-structure.md
    docs/EXECPLAN.md

Important official MCP references used during design:

    https://modelcontextprotocol.io/specification/2025-06-18/architecture
    https://modelcontextprotocol.io/specification/2025-06-18/server/tools
    https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization

## Interfaces and Dependencies

Define these package-level interfaces before implementation details spread.

In `packages/retrieval/src/selection-engine.ts`:

    export interface SelectionEngine {
      selectTools(input: SelectToolsInput): Promise<SelectToolsResult>
    }

In `packages/policy/src/policy-engine.ts`:

    export interface PolicyEngine {
      evaluateExposure(input: ExposureInput): ExposureDecision
      evaluateExecution(input: ExecutionInput): ExecutionDecision
    }

In `packages/gateway/src/execution-gateway.ts`:

    export interface ExecutionGateway {
      callTool(input: ToolCallInput): Promise<ToolCallResult>
    }

In `packages/audit/src/audit-log.ts`:

    export interface AuditLog {
      write(event: AuditEvent): Promise<void>
    }

In `packages/mcp-client/src/connector-manager.ts`:

    export interface McpConnectorManager {
      discoverTools(): Promise<Tool[]>
      callTool(serverId: string, toolName: string, args: unknown): Promise<unknown>
    }

The CLI, daemon, and SDK should depend on these interfaces rather than reaching into implementation files.

## Revision Notes

2026-06-03: Initial ExecPlan created with product scope, architecture, implementation order, validation criteria, and references. The plan intentionally starts with a mock MCP server and lexical retrieval to make the MVP demonstrable before adding real integrations and semantic search.
