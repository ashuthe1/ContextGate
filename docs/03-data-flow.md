# Data Flow

## Overview

ContextGate has two major flows:

1. Tool discovery and indexing.
2. Task-scoped tool selection and execution.

The most important product behavior is that the model does not receive the full global tool catalog. It receives a small task-scoped manifest created after retrieval and policy filtering.

## Flow 1: Tool Discovery And Indexing

This flow runs when ContextGate starts and whenever a downstream server reports that its tool list changed.

    contextgate serve
          |
          v
    load contextgate.yaml
          |
          v
    start/connect downstream MCP servers
          |
          v
    initialize sessions and negotiate capabilities
          |
          v
    call tools/list on each server
          |
          v
    normalize tool metadata
          |
          v
    classify risk and apply policy defaults
          |
          v
    write tool catalog
          |
          v
    build lexical and semantic indexes

### Step Details

1. The config loader reads server definitions, such as `github`, `jira`, and `filesystem`.
2. The connector manager starts stdio MCP servers or connects to remote MCP servers.
3. For each server, ContextGate performs MCP initialization and records declared capabilities.
4. If the server declares tool support, ContextGate calls `tools/list`.
5. Each tool is converted into a stable id: `<server_id>.<tool_name>`.
6. ContextGate computes a metadata hash from name, description, schema, and annotations.
7. If the hash changed, the index is refreshed.
8. ContextGate assigns a risk class using explicit policy first, then heuristic classification.
9. The searchable tool document is written to the index.

### Tool Change Handling

MCP servers that support tool-list change notifications may emit `notifications/tools/list_changed`. When ContextGate receives this notification, it should re-run `tools/list` for that server and update only changed tools.

## Flow 2: Task-Scoped Tool Selection

This flow runs before the model is given tools.

    user prompt
        |
        v
    ContextGate selectTools()
        |
        v
    retrieve candidate tools
        |
        v
    apply exposure policy
        |
        v
    enforce context budget
        |
        v
    create task capability
        |
        v
    return selected tool manifest to agent

### Example

User prompt:

    "Read Jira ticket PROJ-123, inspect the repo, and open a PR with the fix."

Global catalog:

    140 tools across GitHub, Jira, Slack, filesystem, shell, database, and Kubernetes.

Selected manifest:

    jira.get_issue
    github.get_repository
    github.list_files
    github.read_file
    github.create_branch
    github.update_file
    github.create_pull_request
    filesystem.read_file
    filesystem.write_file

Hidden or blocked:

    github.delete_repository
    github.delete_branch
    slack.send_message
    database.run_write_query
    kubernetes.delete_deployment

### Selection Algorithm

The first implementation can use a scoring pipeline:

    candidate_score =
      semantic_score
      + lexical_score
      + workflow_hint_bonus
      + server_hint_bonus
      - risk_penalty
      - schema_size_penalty

Then policy applies:

    if policy mode is hidden:
      do not include in model manifest
    if policy mode is deny:
      do not include in model manifest, reject execution
    if policy mode is ask:
      include only if relevant, require approval on execution
    if policy mode is allow:
      include if relevant

Policy should never be overridden by semantic relevance.

## Flow 3: Tool Execution

The model can call only tools present in the task manifest. ContextGate still validates every call.

    model calls selected tool
          |
          v
    ContextGate receives tools/call or SDK tool invocation
          |
          v
    verify task capability
          |
          v
    validate arguments against schema
          |
          v
    apply execution policy with arguments
          |
          v
    allow, ask, or block
          |
          v
    proxy to downstream MCP server if allowed
          |
          v
    sanitize/redact result if configured
          |
          v
    return result to model

### Execution-Time Checks

Execution checks must include:

- Is the tool part of the task capability?
- Has the capability expired?
- Has the per-task call limit been exceeded?
- Are arguments valid for the tool schema?
- Do arguments match resource constraints?
- Does the tool require approval?
- Has approval already been granted for this exact call or pattern?
- Is the downstream server healthy?

### Approval Example

If policy says `github.delete_branch` is `ask`, ContextGate pauses and shows:

    Approval required
    Tool: github.delete_branch
    Risk: destructive
    Arguments:
      repo: ash/project
      branch: old-auth-flow
    Reason:
      Matched policy rule tools.github.delete_branch.mode = ask
    Action:
      approve once / approve for this task / deny

If the user denies, ContextGate returns a tool error explaining that policy denied execution.

## Flow 4: Explainability

Every selection should be explainable after the fact.

For a task, ContextGate should show:

- How many tools were in the global catalog.
- Which tools were considered candidates.
- Which tools were selected.
- Which tools were hidden by policy.
- Which tools were rejected as irrelevant.
- Which tools were selected but require approval.
- Estimated context tokens saved.

Example:

    Global tools: 140
    Candidate tools: 31
    Selected tools: 9
    Hidden by policy: 18
    Rejected by relevance: 104
    Estimated schema tokens saved: 34,000

## Flow 5: Failure Handling

### Needed Tool Missing

If the agent cannot complete a task because a needed tool was not selected, the host or SDK should let it ask ContextGate for expansion:

    contextgate.expandTools(taskId, "Need to post a summary to Slack")

ContextGate then retrieves additional tools under the same policy. If `slack.send_message` is relevant but configured as `ask`, it can be added to the task capability with approval required.

### Downstream Server Failure

If a downstream MCP server is unavailable, ContextGate should:

- Mark its tools temporarily unavailable.
- Exclude those tools from selection unless explicitly requested.
- Return a clear error if a selected tool fails during execution.
- Log the failure.

### Tool Schema Too Large

If selected tools exceed the context budget, ContextGate should:

1. Prefer higher-ranked tools.
2. Include compact descriptions.
3. Drop low-ranked tools.
4. Offer lazy expansion if the agent requests a specific tool family.

### Policy Ambiguity

If no explicit policy exists, ContextGate should use conservative defaults. For MVP, read-only tools can default to `allow`, high-risk write/destructive tools should default to `ask` or `hide`, and unknown risk should default to `ask`.
