# Policy Model

## Goal

The policy model decides two things:

1. Whether the model is allowed to see a tool for a specific task.
2. Whether a tool call is allowed to execute with specific arguments.

The model should never be the final authority for dangerous actions. ContextGate enforces policy outside the model.

## Policy Modes

### allow

The tool can be exposed when relevant and executed without approval if arguments pass validation.

### ask

The tool can be exposed when relevant, but execution pauses for explicit approval.

### deny

The tool is not exposed to the model and cannot execute. If the model guesses the tool name, execution is rejected with a policy error.

### hide

The tool is invisible to the model. It is omitted from tool manifests and treated as unknown if called. This is useful for reducing attack surface and avoiding model curiosity around dangerous tools.

### shadow

The tool is not exposed by default, but an expansion request can make it available if policy allows. This is useful for tools that are occasionally needed but too noisy for initial context. This can come after MVP.

## Risk Classes

Risk classes are labels used by policy and UI. They should be explicit and understandable.

- read: retrieves information without side effects.
- write_safe: creates or updates non-sensitive data with low blast radius.
- write_external: sends messages or changes data visible to other people.
- destructive: deletes, disables, revokes, resets, drops, or terminates resources.
- privileged_infra: changes production infrastructure, cloud resources, deployments, or access policy.
- monetary: moves money, refunds payments, buys resources, or changes billing.
- credential_access: reads, creates, exports, or modifies secrets, tokens, keys, or credentials.
- unknown: not enough information is available; should default to ask or hide.

## Example Policy

    version: 1

    defaults:
      unknown_tool_mode: ask
      selected_tool_limit: 12
      max_schema_tokens: 8000
      capability_ttl_minutes: 30

    servers:
      github:
        trust: user_configured
        default_mode: allow

      slack:
        trust: user_configured
        default_mode: ask

      postgres_prod:
        trust: user_configured
        default_mode: hide

    tools:
      github.get_issue:
        mode: allow
        risk: read

      github.create_pull_request:
        mode: allow
        risk: write_safe

      github.delete_branch:
        mode: ask
        risk: destructive
        approval:
          show_arguments: true
          allow_remember_for_task: true

      github.delete_repository:
        mode: deny
        risk: destructive

      slack.send_message:
        mode: ask
        risk: write_external
        constraints:
          allowed_channels:
            - "#dev"
            - "#test-agents"

      postgres_prod.run_query:
        mode: ask
        risk: unknown
        constraints:
          readonly_sql_only: true

      shell.run_command:
        mode: ask
        risk: privileged_infra
        constraints:
          deny_patterns:
            - "rm -rf"
            - "curl * | sh"
            - "sudo *"

    selection:
      max_tools: 12
      min_relevance_score: 0.42
      risk_penalties:
        read: 0.00
        write_safe: 0.05
        write_external: 0.15
        destructive: 0.35
        privileged_infra: 0.35
        monetary: 0.45
        credential_access: 0.50
        unknown: 0.25

    logging:
      store_prompt_text: false
      redact_secrets: true
      audit_path: ".contextgate/audit.jsonl"

## Policy Precedence

Policy should be evaluated in this order:

1. Hard-coded emergency denies, such as known destructive shell patterns.
2. Explicit tool policy.
3. Explicit server policy.
4. Risk-class policy.
5. Global defaults.

The most specific rule wins unless an earlier emergency deny applies.

## Exposure Policy

Exposure policy runs before the model sees tools.

Inputs:

- User id.
- Project id.
- Prompt.
- Tool id.
- Tool risk.
- Tool relevance score.
- Server trust level.
- Context budget.

Output:

- selected.
- hidden.
- blocked.
- not_relevant.
- selected_requires_approval.

Rules:

- `hide` tools never appear in the model manifest.
- `deny` tools never appear in the model manifest.
- `ask` tools may appear if relevant, but they must be marked as requiring approval.
- `allow` tools may appear if relevant.
- Unknown tools should not appear unless the user has configured a permissive mode.

## Execution Policy

Execution policy runs every time a tool call is attempted.

Inputs:

- Task id.
- Capability id.
- Tool id.
- Arguments.
- User id.
- Project id.
- Current time.
- Prior approvals.
- Tool call count.

Output:

- allow.
- require_approval.
- block.

Rules:

- The tool must be part of the task capability.
- The capability must not be expired.
- Arguments must match schema.
- Arguments must satisfy resource constraints.
- Denied and hidden tools must be blocked even if the model guessed the name.
- Approval must be tied to either one exact call, one resource pattern, or one task.

## Resource Constraints

Resource constraints prevent broad tool permissions from becoming dangerous.

Examples:

    tools:
      github.update_file:
        mode: allow
        constraints:
          repositories:
            - "ash/contextgate"
          protected_branches:
            - "main"
            - "production"
          deny_paths:
            - ".env"
            - "secrets/**"

      kubernetes.restart_deployment:
        mode: ask
        constraints:
          namespaces:
            - "dev"
            - "staging"
          deny_namespaces:
            - "prod"

      filesystem.write_file:
        mode: allow
        constraints:
          roots:
            - "/Users/ashugaut/Learnings/Projects"
          deny_paths:
            - "**/.ssh/**"
            - "**/.aws/**"
            - "**/.env"

## Approval Semantics

Approval should be precise.

Approval scopes:

- once: approve this exact call only.
- same_arguments_for_task: approve repeated calls with identical arguments in this task.
- resource_for_task: approve calls to the same resource in this task.
- policy_update: persist a new policy rule.

The MVP should support `once` and `same_arguments_for_task`.

## Redaction

Audit logs and tool results should redact secrets by default. Redaction should apply to:

- Tool arguments.
- Tool outputs.
- Prompt text if stored.
- Error messages.

Common patterns:

- API keys.
- OAuth tokens.
- AWS access keys.
- Private keys.
- Password fields.
- Authorization headers.

## Context Poisoning Defense

ContextGate cannot fully solve prompt injection, but it can reduce exposure.

Defenses:

- Do not expose irrelevant tools.
- Do not trust server-provided annotations for policy.
- Prefer user-controlled risk labels over tool-supplied labels.
- Sanitize tool descriptions before embedding if they contain suspicious instruction-like text.
- Redact or summarize untrusted tool output before returning it to the model.
- Log when a tool description includes suspicious phrases such as "ignore previous instructions" or "send secrets".

## Policy Test Command

The CLI should support a dry-run command:

    contextgate policy test --prompt "delete old branch after merge"

Expected output:

    Selected:
      github.list_branches      allow
      github.get_pull_request   allow
      github.delete_branch      ask

    Hidden:
      github.delete_repository  deny

    Reason:
      github.delete_branch matched destructive risk class and explicit mode ask.
