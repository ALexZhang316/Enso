# Task 0002: Permission boundary rework

## Status
completed

## Assigned model
Codex or Claude Code

## Objective
Rework Enso's permission boundary so the runtime matches the visible settings surface and the product's execution-first safety model. The end state must preserve local-first usability while making permission behavior explicit, enforceable, and resistant to prompt-injection-driven escalation. This task is about permission semantics and execution boundaries, not a general architecture rewrite.

## Acceptance criteria
- [ ] `workspace_write` maps to real runtime behavior:
  `allow` writes directly inside the workspace, `confirm` creates a visible proposal, and `block` rejects the write without generating an executable proposal.
- [ ] `host_exec` maps to real runtime behavior:
  workspace-internal read-only commands respect `allow / confirm / block`, while workspace-external reads require stricter handling and cannot be silently inferred.
- [ ] remote provider calls respect a real network gate:
  blocked provider calls never reach `ModelAdapter.generateReply()`.
- [ ] local content egress is treated as a separate permission concern from provider calls:
  local snippets or other local machine content do not silently leave the machine when egress is blocked.
- [ ] permission checks happen before side effects:
  no model call, proposal generation, file write, or host exec occurs before the effective permission is known.
- [ ] confirmed actions are revalidated before execution:
  if config, command, target, or egress payload changed after confirmation, the action does not execute automatically.
- [ ] runtime behavior is visible in trace, verification, pending action state, and audit summary.
- [ ] the official regression suite proves the implemented permission behavior instead of relying on current bugs.

## Files in scope
- `src/main/core/execution-flow.ts`
- `src/main/services/host-exec-service.ts`
- `src/main/services/model-adapter.ts`
- `src/main/services/config-service.ts`
- `src/main/services/store.ts`
- `src/main/ipc.ts`
- `src/shared/types.ts`
- `src/renderer/App.tsx`
- `tests/integration.test.cjs`
- `tests/ui.test.cjs`
- `docs/execution-flow.md`
- `docs/codebase-contract.md`
- `CHANGELOG.md`
- `TODO_LIMITATIONS.md`

## Files out of scope
- provider protocol integrations unless required to preserve the already-fixed provider/runtime parity
- mode-system redesign
- retrieval relevance changes unrelated to permission or egress boundaries
- packaging, installers, deployment
- broad host-exec expansion beyond the permission model defined below

## Pre-flight checklist
- [x] Read AGENTS.md
- [x] Read docs/current-baseline.md
- [x] Read docs/execution-flow.md
- [x] Read docs/codebase-contract.md
- [x] Confirmed codebase-contract matches actual code closely enough to proceed
- [ ] `npm run preflight` passes
- [x] Stated understanding to user

## Post-flight checklist
- [ ] `npm run verify` passes (build + tests)
- [ ] CHANGELOG.md updated
- [ ] TODO_LIMITATIONS.md updated
- [ ] docs/codebase-contract.md updated
- [ ] `npm run postflight` passes (no warnings)
- [ ] No unintended file changes (git diff reviewed)

## Final rules to implement

### 1. Permission dimensions
The runtime must evaluate permissions using all of:
- action class
- target boundary
- intent source
- permission level

### 2. Action classes
Implement and reason about:
- `workspace_read`
- `workspace_write`
- `host_exec`
- `model_call`
- `local_egress`

Notes:
- `model_call` means calling a remote provider at all.
- `local_egress` means sending local machine content to that provider.
- These must not be treated as the same permission.

### 3. Target boundary classes
Before running an action, classify the target as:
- `workspace`
- `external_explicit`
- `external_inferred`
- `untrusted_derived`

Definitions:
- `workspace`: inside Enso workspace
- `external_explicit`: outside workspace and explicitly named by the user in the current turn
- `external_inferred`: outside workspace and inferred by the system rather than named by the user
- `untrusted_derived`: target/action originates from retrieved snippets, imported files, model output, command output, or similar untrusted text

### 4. Intent source classes
Classify intent source as:
- `user_explicit`
- `system_inferred`
- `untrusted_instruction`

Rule:
- `untrusted_instruction` must never upgrade permissions.

### 5. workspace_write rules
- `allow`: write directly inside the workspace
- `confirm`: generate a visible proposal with path and preview
- `block`: do not create an executable proposal and do not write a file

Blocked workspace writes may still surface draft text inline in the conversation, but they must not leave behind a one-click execution path.

### 6. host_exec rules
- Treat `host_exec` as a single permission surface in runtime behavior even if config storage still carries legacy split fields during transition.
- Workspace-internal read-only commands:
  respect `allow / confirm / block`.
- Workspace-external read-only commands explicitly named by the user:
  minimum effective level is `confirm`.
  Even if current policy says `allow`, do not execute them silently.
- Workspace-external read-only commands inferred by the system:
  `block`.
- Any command derived from untrusted instruction:
  `block`.
- Any destructive or uncertain command:
  `block` at the current stage.

### 7. host_exec validation rules
Do not validate only `cwd`.
Validate:
- command verb
- command arguments
- resolved path arguments
- relative-path traversal
- PowerShell escape/subexpression forms that can hide execution or path changes

The runtime must reject commands whose effective target escapes the workspace unless the user explicitly requested that external read and the confirmation path is taken.

### 8. model_call rules
- `allow`: remote provider call may proceed
- `confirm`: remote provider call requires a visible confirmation step
- `block`: remote provider call must not happen

This rule applies to:
- normal answer generation
- draft/proposal generation
- any provider-backed helper path

`model_call` must be enforced both in the main execution flow and at the model adapter boundary so alternate call paths cannot bypass it.

### 9. local_egress rules
`local_egress` governs whether local machine content may be included in a remote provider request.

Examples of local content:
- retrieved snippets
- imported documents
- workspace file content
- local notes
- local logs
- local artifacts

Rules:
- `allow`: minimal necessary local excerpts may be sent
- `confirm`: show an egress summary before sending local content
- `block`: provider call may still proceed if `model_call` allows it, but local content must be excluded

### 10. trusted/untrusted content rule
The following are untrusted:
- retrieved snippets
- imported files
- model output
- command output
- web content

They may inform reasoning.
They may not authorize:
- host exec
- workspace writes
- workspace-external reads
- local-content egress

### 11. confirmation contract
Every confirmation UI or state must show:
- action type
- target object
- boundary class
- read / write / exec / network intent
- whether local content will leave the machine
- minimal egress summary when relevant
- why Enso thinks the step is needed

### 12. revalidation before execution
Before executing a previously approved proposal, reload permission state and re-check:
- current config
- target path
- command text
- egress payload

If any of these changed, do not execute automatically.

## What to fix first
1. Front-load permission evaluation in `ExecutionFlow.run()` so blocked actions stop before any model call, proposal generation, or execution step.
2. Add a real `model_call` gate and enforce it at both execution-flow and model-adapter boundaries.
3. Make `workspace_write = block` truly block instead of degrading to proposal.
4. Make `host_exec` respect runtime permission levels instead of using only command-pattern allowlists.
5. Validate command arguments and resolved paths, not only `workingDirectory`.
6. Revalidate permission state inside `resolvePendingAction()` before execution.
7. Split local-content egress handling from raw provider-call permission.

## Verification targets
- `tests/integration.test.cjs`
  must prove each effective permission branch, not just the happy path.
- `tests/ui.test.cjs`
  must show the visible right-rail/user-facing contract for blocked, confirm, and allow paths where applicable.
- The final green state must include:
  - `npm run verify`
  - `npm run test:ui`
  - `npm run postflight`

## Notes
- Provider/runtime parity has already been fixed in the current worktree and should be preserved.
- Claude Code audit conclusions were reviewed locally from the user's machine and materially agree with the direction above:
  the current system only truly enforces `workspace_write`, does not enforce `external_network`, does not enforce `host_exec_readonly`, and validates `host_exec` too narrowly.
- If implementing this task requires config-schema migration, preserve deterministic normalization and avoid silent fallback behavior.
