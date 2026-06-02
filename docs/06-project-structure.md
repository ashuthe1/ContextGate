# Proposed Project Structure

## Stack Recommendation

Use TypeScript for the MVP. The project needs fast iteration around MCP, local CLI behavior, JSON schemas, and developer SDKs. TypeScript is also practical for publishing npm packages and integrating with agent apps.

Recommended tooling:

- npm workspaces.
- TypeScript.
- Vitest for unit tests.
- tsup for package builds.
- Commander or oclif for CLI.
- Fastify for local HTTP API.
- SQLite after the first JSONL prototype.

Do not add React or Next.js until the CLI and gateway prove the core workflow.

## Repository Layout

    contextgate/
      README.md
      package.json
      package.json
      tsconfig.base.json
      .gitignore
      .env.example

      apps/
        cli/
          package.json
          src/
            main.ts
            commands/
              init.ts
              index.ts
              serve.ts
              select.ts
              policy-test.ts

        daemon/
          package.json
          src/
            server.ts
            routes/
              health.ts
              tool-selection.ts
              tool-call.ts
              task-explanation.ts

        web/
          package.json
          src/
            // Add later after MVP.

      packages/
        core/
          package.json
          src/
            types.ts
            ids.ts
            errors.ts
            config.ts

        mcp-client/
          package.json
          src/
            connector-manager.ts
            stdio-connector.ts
            http-connector.ts
            tool-discovery.ts
            mcp-types.ts

        catalog/
          package.json
          src/
            catalog-store.ts
            tool-normalizer.ts
            tool-hasher.ts
            schema-summarizer.ts

        retrieval/
          package.json
          src/
            lexical-index.ts
            semantic-index.ts
            scorer.ts
            selection-engine.ts

        policy/
          package.json
          src/
            policy-loader.ts
            policy-engine.ts
            risk-classifier.ts
            constraints.ts
            approvals.ts

        gateway/
          package.json
          src/
            capability-store.ts
            execution-gateway.ts
            argument-validator.ts
            result-sanitizer.ts

        audit/
          package.json
          src/
            audit-log.ts
            jsonl-writer.ts
            redaction.ts

        sdk/
          package.json
          src/
            client.ts
            agent-adapter.ts

      examples/
        mock-mcp-server/
          package.json
          src/
            server.ts

        sample-agent/
          package.json
          src/
            run.ts

        policies/
          coding-agent-safe.yaml
          readonly-research.yaml
          internal-tools-cautious.yaml

      docs/
        01-product-brief.md
        02-technical-architecture.md
        03-data-flow.md
        04-policy-model.md
        05-product-roadmap.md
        06-project-structure.md
        EXECPLAN.md

## Package Responsibilities

### apps/cli

The user-facing command line. It should only parse arguments, call package APIs, and format output.

Commands:

- `contextgate init`
- `contextgate index`
- `contextgate serve`
- `contextgate select`
- `contextgate policy test`

### apps/daemon

The local HTTP service. It exposes APIs for SDK clients and future UI. It should call the same core packages as the CLI.

Endpoints:

- `GET /health`
- `POST /v1/tool-selection`
- `POST /v1/tool-call`
- `GET /v1/tasks/:taskId/explanation`

### packages/core

Shared types, config parsing, ids, and errors. This package should not depend on CLI, daemon, or UI code.

### packages/mcp-client

Owns downstream MCP communication. It starts stdio servers, connects to HTTP servers, performs initialization, calls `tools/list`, and calls `tools/call`.

### packages/catalog

Normalizes and stores tool metadata. It turns MCP tool definitions into ContextGate tool records.

### packages/retrieval

Finds relevant tools for a prompt. The first version can use lexical scoring. A later version can add embeddings behind the same interface.

Important interface:

    interface ToolRetriever {
      retrieve(input: RetrieveToolsInput): Promise<CandidateTool[]>
    }

### packages/policy

Loads policy files, classifies risk, and decides whether tools can be exposed or executed.

Important interface:

    interface PolicyEngine {
      evaluateExposure(input: ExposureInput): ExposureDecision
      evaluateExecution(input: ExecutionInput): ExecutionDecision
    }

### packages/gateway

Creates task-scoped capabilities and proxies allowed tool calls to downstream MCP servers.

Important interface:

    interface ExecutionGateway {
      callTool(input: ToolCallInput): Promise<ToolCallResult>
    }

### packages/audit

Writes audit events and redacts secrets.

Important interface:

    interface AuditLog {
      write(event: AuditEvent): Promise<void>
    }

### packages/sdk

Developer-facing SDK for custom agents.

Example:

    import { ContextGate } from "@contextgate/sdk"

    const gate = new ContextGate({ baseUrl: "http://localhost:3737" })

    const selection = await gate.selectTools({
      prompt: "Read PROJ-123 and open a PR",
      projectId: "demo"
    })

    const result = await myAgent.run({
      prompt,
      tools: selection.tools
    })

## Local State

ContextGate should create a local `.contextgate` directory in the project or user config directory.

Suggested files:

    .contextgate/
      catalog.json
      index.json
      audit.jsonl
      tasks/
        task_123.json

SQLite can replace these files later:

    .contextgate/contextgate.db

## Configuration File

Default path:

    contextgate.yaml

Example:

    version: 1

    servers:
      github:
        transport: stdio
        command: "github-mcp-server"
        args: []

      filesystem:
        transport: stdio
        command: "filesystem-mcp-server"
        args:
          - "/Users/ashugaut/Learnings/Projects"

    policy:
      file: "examples/policies/coding-agent-safe.yaml"

    selection:
      maxTools: 12
      maxSchemaTokens: 8000

    audit:
      path: ".contextgate/audit.jsonl"
      storePromptText: false

## Testing Strategy

Unit tests:

- Config parsing.
- Tool normalization.
- Risk classification.
- Lexical retrieval.
- Policy precedence.
- Argument constraint checks.
- Redaction.

Integration tests:

- Mock MCP server exposes tools.
- ContextGate indexes mock tools.
- Prompt selects expected tools.
- Hidden tools are not returned.
- Denied tools cannot execute.
- Ask tools create approval requests.

End-to-end test:

- Start mock MCP server.
- Start ContextGate daemon.
- Run sample agent.
- Verify the agent receives fewer tools than the catalog.
- Verify a dangerous guessed tool call is blocked.

## Development Order

1. Create monorepo skeleton.
2. Implement core types and config.
3. Implement mock MCP server.
4. Implement tool catalog from mock tools.
5. Implement lexical retrieval.
6. Implement policy engine.
7. Implement `contextgate select`.
8. Implement local HTTP daemon.
9. Implement execution gateway.
10. Implement approvals.
11. Implement sample agent.
12. Add SQLite and semantic retrieval after the first working demo.
