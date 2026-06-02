# Product Roadmap

## Product Name

ContextGate

## Positioning

ContextGate is least-privilege tool access for AI agents. It retrieves and exposes only the MCP tools relevant to the current task, then enforces policy before execution.

## Roadmap Strategy

The roadmap should avoid building a broad agent platform. The product should first win a narrow developer workflow:

    "I have many MCP tools connected to my coding agent. ContextGate keeps the model context small and blocks or asks before risky actions."

Each milestone should be independently useful and demoable.

## Phase 0: Validation And Design

Timebox: 1 week.

Goal: Prove that developers recognize the problem and would try a local-first tool router.

Deliverables:

- Landing page or README with the problem statement.
- Demo GIF mockup showing 140 tools reduced to 8 tools.
- Three sample policies: coding-agent-safe, data-analyst-safe, internal-tools-safe.
- Competitive notes against observability tools, emphasizing that ContextGate is not a tracing dashboard.
- Short survey or outreach to 10 developers using MCP or coding agents.

Validation questions:

- How many MCP servers/tools do they currently connect?
- Have they noticed context bloat from tools?
- Do they worry about dangerous tools being visible to the model?
- Would they prefer hidden, ask, or deny modes?
- Which client would they want first: Claude Desktop, Cursor, custom SDK, or CLI?

Go/no-go signal:

- At least 5 developers say they would install a local tool to reduce MCP tool exposure.
- At least 3 developers can name a dangerous tool they would want gated.

## Phase 1: Local CLI MVP

Timebox: 2 to 3 weeks.

Goal: Build a local proof that connects MCP servers, indexes tools, selects relevant tools for a prompt, applies policy, and explains decisions.

Features:

- `contextgate init` creates config.
- `contextgate index` connects to configured MCP servers and calls `tools/list`.
- Local tool catalog stored in JSON or SQLite.
- Lexical search over tools.
- Optional semantic search if embeddings are easy.
- Policy modes: allow, ask, deny, hide.
- Risk classes: read, write_safe, write_external, destructive, privileged_infra, monetary, credential_access, unknown.
- `contextgate select "<prompt>"` returns selected tools and hidden/blocked reasons.
- JSONL audit log.

Demo:

    contextgate select "Read Jira ticket PROJ-123 and open a PR"

Expected behavior:

- Shows total available tools.
- Shows selected tools.
- Shows hidden and blocked tools.
- Shows estimated context tokens saved.

Success metric:

- The CLI can reduce a catalog of at least 50 mock or real tools to under 12 relevant tools with understandable explanations.

## Phase 2: Execution Gateway

Timebox: 3 to 4 weeks.

Goal: Let agents call selected tools through ContextGate and enforce execution policy.

Features:

- Local HTTP API for `selectTools` and `callTool`.
- TypeScript SDK for custom agents.
- Task capability creation.
- Capability expiration.
- Execution-time policy enforcement.
- Terminal approval flow for `ask`.
- Argument validation against MCP input schema.
- Proxy allowed calls to downstream MCP servers.
- Log call results, latency, and policy decisions.

Demo:

    contextgate serve --config contextgate.yaml

Then a sample agent asks for tools, receives a narrowed manifest, calls `github.create_pull_request`, and is blocked or prompted if it tries `github.delete_branch`.

Success metric:

- A sample agent can complete a realistic GitHub/Jira task using only tools selected by ContextGate.
- A guessed dangerous tool call is blocked even if the model produces the correct tool name.

## Phase 3: First Real Integrations

Timebox: 3 to 5 weeks.

Goal: Make ContextGate useful with real developer workflows.

Integrations:

- GitHub MCP server.
- Filesystem MCP server.
- Shell MCP server.
- Jira MCP server if available locally.
- Slack MCP server as an approval-risk example.

Features:

- Preset policy: `coding-agent-safe`.
- Preset policy: `readonly-research`.
- Preset policy: `team-tools-cautious`.
- Server health checks.
- Tool list change handling.
- Selection expansion: `expandTools(taskId, reason)`.
- Better risk classifier using name, description, schema, and user overrides.

Demo:

    contextgate init --preset coding-agent-safe
    contextgate serve
    contextgate select "Fix issue PROJ-123 and create a PR"

Success metric:

- A new user can configure two MCP servers and see meaningful filtered selection within 15 minutes.

## Phase 4: Developer UX And UI

Timebox: 4 to 6 weeks.

Goal: Make the product easier to understand and debug.

Features:

- Local web UI.
- Tool catalog browser.
- Policy editor with safe defaults.
- Approval queue.
- Task timeline.
- Selection explanation page.
- Import/export policy.
- Context token savings report.

Success metric:

- Users can edit policy without reading YAML.
- Users can explain why a tool was hidden or selected within one UI screen.

## Phase 5: Team And Distribution

Timebox: 6 to 10 weeks.

Goal: Turn the project into something teams can adopt.

Features:

- Shared policy repository support.
- Signed policy bundles.
- Team approval mode.
- OpenTelemetry or JSON export.
- GitHub Action for policy tests.
- Hosted optional control plane for teams, while keeping local execution possible.

Success metric:

- A small team can standardize policies across multiple developers.

## Phase 6: Advanced Tool Routing

Timebox: ongoing.

Goal: Improve accuracy and safety for large tool catalogs.

Features:

- Hybrid retrieval with embeddings and lexical scoring.
- Workflow-aware routing.
- Tool schema summarization.
- Tool output trust scoring.
- Prompt-injection heuristics for tool descriptions and outputs.
- Policy regression tests against saved task traces.
- Automatic suggestions for policy tightening.

Success metric:

- Lower missing-tool rate without increasing exposed-tool count.

## First Public Launch Scope

The first public launch should include:

- Open-source repository.
- CLI.
- Local config.
- Tool indexing.
- Tool selection.
- Policy modes.
- Simple execution gateway.
- Terminal approvals.
- GitHub/filesystem/shell demo.
- Short demo video.
- Clear docs explaining "before: 120 tools, after: 8 tools."

Do not wait for:

- Hosted SaaS.
- Full web UI.
- Perfect semantic search.
- Every MCP client integration.

## Possible Pricing Later

Open-source:

- Local CLI.
- Local policy.
- Local audit logs.
- Basic integrations.

Paid hosted/team:

- Shared policies.
- Team audit trails.
- Central approvals.
- Policy analytics.
- Compliance exports.
- Managed connectors.

This pricing should not be designed too early. The first priority is real usage by developers.

## Risks

### MCP Client Integration Limits

Some AI hosts may not allow enough control over dynamic tool exposure. Mitigation: start with SDK and local service where the integration is under your control.

### Retrieval Mistakes

The router may hide a tool the agent needs. Mitigation: add tool expansion, explanations, and conservative workflow presets.

### Security Overclaiming

The product must not claim to eliminate prompt injection. Mitigation: position as least-privilege context and policy enforcement, not complete AI security.

### Too Much Platform Scope

It is easy to drift into observability, evals, hosted dashboards, and marketplace features. Mitigation: keep the core promise: "right tools, right time, right permissions."

## Interview Value

This project demonstrates:

- Protocol engineering with MCP and JSON-RPC.
- Retrieval and ranking for tool selection.
- Policy engine design.
- Capability-based access control.
- Secure proxy/gateway design.
- Audit logging and replayable decisions.
- Product judgment in a current AI infrastructure problem.
