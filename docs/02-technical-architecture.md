# Technical Architecture

## Architecture Goal

ContextGate sits between an AI host and one or more MCP servers. Its job is to reduce and govern the tool surface exposed to the model. It discovers all available tools, indexes them locally, selects task-relevant tools, enforces policy, and proxies approved tool calls.

MCP uses a host-client-server architecture. A host is the AI application, such as an agent runtime or desktop assistant. A client is the component that connects to one server. A server exposes capabilities such as tools, resources, and prompts. Tool discovery happens through `tools/list`; tool execution happens through `tools/call`.

ContextGate acts like a host-side control plane and gateway. It manages many downstream MCP clients and exposes a narrow task-scoped tool surface upstream.

## High-Level Diagram

    AI host or custom agent
            |
            | task prompt and tool calls
            v
    ContextGate adapter / router
            |
            | selected tool manifest
            v
    ContextGate execution gateway
            |
            | MCP JSON-RPC
            v
    GitHub MCP | Jira MCP | Slack MCP | DB MCP | Filesystem MCP | Shell MCP

## Product Modes

ContextGate should support three modes over time. The MVP should implement the first two only if the second is easy; otherwise start with SDK mode.

### Mode 1: SDK Mode

Custom agent developers call ContextGate before a model run:

    selectedTools = await contextgate.selectTools({
      prompt,
      userId,
      projectId,
      maxTools: 12
    })

    result = await agent.run(prompt, { tools: selectedTools })

The SDK is the easiest integration because ContextGate receives the original user prompt before the model sees tools.

### Mode 2: Router MCP Server Mode

ContextGate itself appears to the AI host as one MCP server. Instead of exposing every downstream tool, it exposes a small router surface, such as:

- contextgate.plan_tools
- contextgate.call_tool
- contextgate.explain_selection

This mode can work with MCP-native clients that do not support custom SDK hooks, but it is less elegant because the model still needs to use a router tool before seeing task-specific tools.

### Mode 3: Transparent Proxy Mode

ContextGate proxies MCP traffic between a host and downstream servers. It intercepts `tools/list` and returns a filtered list. This mode is attractive but harder because a pure proxy may not know the user's original prompt. It works best when paired with host integration or a task-start API.

## Core Components

### Config Loader

Reads `contextgate.yaml`. This file defines downstream MCP servers, user/project policies, embedding settings, approval settings, logging settings, and context budget defaults.

### MCP Connector Manager

Starts and manages downstream MCP server connections. For each server, it performs initialization, capability negotiation, and tool discovery. It should support stdio transport first because many local MCP servers use it. Streamable HTTP can come later.

### Tool Catalog

Stores normalized tool metadata from all connected MCP servers. A tool catalog record includes:

- Stable tool id, such as `github.delete_branch`.
- Server id.
- MCP tool name.
- Title.
- Description.
- Input JSON schema.
- Optional output JSON schema.
- Annotations from the server.
- First seen and last seen timestamps.
- Tool hash for change detection.
- Trust level of the server.

The catalog should not blindly trust server-provided annotations. Server metadata is useful for retrieval, but policy and risk classification should be controlled by ContextGate or the user.

### Tool Index

Builds searchable representations of tools:

- Lexical index over names, descriptions, schema property names, and server names.
- Semantic vector index over a compact text representation of each tool.
- Optional workflow tags, such as `github-pr`, `incident-response`, or `customer-support`.

For MVP, local embeddings and a lightweight vector store are enough. A simpler fallback can use keyword scoring first, then add embeddings.

### Selection Engine

Receives a task prompt and returns candidate tools. It scores candidates using:

- Semantic similarity to the task.
- Exact matches on tool and domain words.
- Prior usage in similar tasks.
- Server relevance.
- Risk penalty.
- Policy eligibility.
- Context budget constraints.

The output is a task-scoped tool manifest. This manifest is the only tool surface the model should see for that task.

### Policy Engine

Evaluates whether a tool can be exposed and whether a tool call can execute. It uses policy files and runtime context:

- User id.
- Project id.
- Workspace path.
- Task prompt metadata.
- Tool id.
- Tool arguments.
- Resource scope.
- Risk class.

Policy is enforced twice:

1. Exposure time: decide whether the model can see the tool.
2. Execution time: decide whether the tool call can run with the supplied arguments.

Execution-time checks are mandatory because a model may attempt a hidden or stale tool call.

### Approval Broker

Handles `ask` decisions. For MVP, this can be a terminal prompt. Later, it can become a web UI, desktop notification, or Slack approval.

The approval prompt must show:

- Tool id.
- Arguments.
- Risk class.
- Target resource.
- Why the tool was selected.
- Exact policy rule that requires approval.

### Execution Gateway

Proxies approved `tools/call` requests to the correct downstream MCP server and returns the result. It also enforces timeouts, argument validation, and audit logging.

### Audit Log

Writes local records for selection and execution events. MVP can use JSONL. SQLite should follow soon because it makes querying and replay easier.

Event types:

- server_connected
- tools_discovered
- tool_indexed
- task_started
- tool_candidate_scored
- tool_selected
- tool_hidden
- tool_blocked
- approval_requested
- approval_granted
- approval_denied
- tool_call_started
- tool_call_finished
- tool_call_failed

### Admin CLI

The CLI is the first product UI. It should support:

- `contextgate init`
- `contextgate index`
- `contextgate serve`
- `contextgate select "task prompt"`
- `contextgate explain --run <id>`
- `contextgate policy test`
- `contextgate approvals`

### Web UI

The web UI is not required for the first MVP. When added, it should focus on practical workflows:

- Tool catalog browser.
- Policy editor.
- Task run timeline.
- Approval queue.
- Selection explanation.

## Data Model

### Tool

    Tool {
      id: string
      serverId: string
      name: string
      title?: string
      description?: string
      inputSchema: JsonSchema
      outputSchema?: JsonSchema
      annotations?: object
      trustLevel: "trusted" | "user_configured" | "unknown"
      riskClass: RiskClass
      hash: string
      firstSeenAt: timestamp
      lastSeenAt: timestamp
    }

### Task

    Task {
      id: string
      userId?: string
      projectId?: string
      promptText?: string
      promptHash: string
      createdAt: timestamp
      maxTools: number
      maxSchemaTokens: number
    }

### ToolSelection

    ToolSelection {
      taskId: string
      toolId: string
      score: number
      decision: "selected" | "hidden" | "blocked" | "not_relevant"
      reasons: string[]
      policyRuleId?: string
    }

### Capability

    Capability {
      id: string
      taskId: string
      toolIds: string[]
      expiresAt: timestamp
      callLimits: object
      resourceConstraints: object
    }

### ToolCall

    ToolCall {
      id: string
      taskId: string
      capabilityId: string
      toolId: string
      arguments: object
      decision: "allowed" | "approval_required" | "blocked"
      approvalId?: string
      startedAt?: timestamp
      finishedAt?: timestamp
      latencyMs?: number
      resultSummary?: string
      error?: string
    }

## APIs

The local service should expose HTTP APIs for SDK and UI clients.

### Select Tools

    POST /v1/tool-selection

Request:

    {
      "prompt": "Read Jira ticket PROJ-123 and open a PR with a fix",
      "userId": "local-user",
      "projectId": "my-repo",
      "maxTools": 12
    }

Response:

    {
      "taskId": "task_123",
      "capabilityId": "cap_123",
      "tools": [
        {
          "id": "jira.get_issue",
          "name": "get_issue",
          "description": "Fetch a Jira issue by key",
          "inputSchema": {}
        }
      ],
      "hiddenCount": 94,
      "reasons": {
        "jira.get_issue": ["semantic match: jira ticket", "policy: allow"]
      }
    }

### Call Tool

    POST /v1/tool-call

Request:

    {
      "taskId": "task_123",
      "capabilityId": "cap_123",
      "toolId": "github.create_pull_request",
      "arguments": {
        "repo": "user/project",
        "branch": "fix-proj-123"
      }
    }

Response:

    {
      "decision": "allowed",
      "result": {
        "content": [
          { "type": "text", "text": "Created PR #42" }
        ]
      }
    }

### Explain Selection

    GET /v1/tasks/:taskId/explanation

Returns selected, hidden, blocked, and rejected candidate tools with reasons.

## Tool Representation For Retrieval

Each tool should be converted into a compact retrieval document:

    server: github
    tool: delete_branch
    title: Delete branch
    description: Delete a branch from a repository
    input properties: repo, branch
    risk: destructive
    side effect: deletes source-control branch

Do not embed raw huge schemas directly if they are large. Store full schemas separately and embed a summarized representation.

## Security Model

ContextGate does not make MCP inherently safe. It reduces risk by enforcing least privilege outside the model.

Important rules:

- Hidden tools are not included in task tool manifests.
- Denied tools cannot execute even if the model guesses their names.
- Risky tools require approval before execution.
- Tool arguments are checked at execution time.
- Server-provided metadata is not trusted for policy decisions.
- Tool outputs can be redacted, summarized, or marked untrusted before being passed back to the model.
- All decisions are logged for audit.

## Technology Choices

Recommended MVP stack:

- TypeScript for CLI, local service, SDK, and MCP integration.
- Node.js because many MCP examples and SDKs are JavaScript/TypeScript-friendly.
- SQLite for durable local state after the earliest JSONL version.
- A local vector store or embedded SQLite vector extension later; simple lexical search can ship first.
- React or Next.js only after the CLI proves value.

The router must be library-first. The CLI and future web UI should call core packages rather than embedding business logic.
