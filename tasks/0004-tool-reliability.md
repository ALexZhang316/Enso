# Task 0004: Tool reliability

## Status
ready

## Ownership
- Decision owner: Alex
- Spec / review owner: Claude
- Implementation / integration owner: Codex

## Branch
`feat/tool-reliability`

## Objective

Upgrade tool execution from stub code to real, working pipelines. Workspace-write should write real files, host-exec should capture real output, and all tools should return structured results.

## Acceptance criteria
- [ ] `tool-service.ts` returns a structured `ToolRunResult` for every tool call, matching the interface in `docs/spec/tools.md`: `{ toolName, success, output, sideEffects, error }`
- [ ] `workspace-service.ts` can write a file to the Enso workspace directory for real; path validation rejects any path outside the workspace root
- [ ] `host-exec-service.ts` captures stdout, stderr, and exit code from real command execution; enforces a configurable timeout (default 30s); kills the process on timeout
- [ ] Permission gating is preserved: workspace-write respects the allow/confirm/block level, host-exec respects its own level
- [ ] New or updated integration tests cover: successful write, write-outside-workspace rejection, command execution with output capture, command timeout, permission block scenarios
- [ ] `npm run build && npm run test:all` passes

## Verification plan
- `npm run build` succeeds
- `npm run test:all` passes
- Integration tests prove: a file is actually written and readable, a command's stdout is captured, a timed-out command is killed

## Spec references
- `docs/spec/tools.md` - ToolRunResult interface, 6 tool types, routing rules, failure handling
- `docs/spec/permission.md` - gate timing, per-action behavior table, post-confirmation revalidation
- `docs/codebase-contract.md` - module ownership for tool-service, workspace-service, host-exec-service

## Files in scope
- `src/main/services/tool-service.ts`
- `src/main/services/workspace-service.ts`
- `src/main/services/host-exec-service.ts`
- `src/shared/types.ts` (only: add new interfaces at the end of the file)
- `tests/integration.test.cjs` (only: append new test cases at the end)

## Files out of scope
- `src/main/core/execution-flow.ts`
- `src/main/services/model-adapter.ts`
- `src/renderer/` (all renderer files)
- `src/main/providers/` (provider implementations)
- `docs/spec/` (do not modify specs)
- `CHANGELOG.md`, `TODO_LIMITATIONS.md`, `docs/codebase-contract.md` (shared docs, updated only by last branch to merge)

## Parallel merge rules
This branch merges **second** (after 0003, before 0005).
- Add new types to `src/shared/types.ts` at the **end** of the file. Do not reorganize existing types.
- Add new integration tests at the **end** of `tests/integration.test.cjs`. Do not reorganize existing tests.
- Do NOT update shared docs -- the last branch to merge handles that.

## Pre-flight checklist
- [ ] Read AGENTS.md
- [ ] Read docs/collaboration-protocol.md
- [ ] Read docs/baseline.md
- [ ] Read docs/architecture.md
- [ ] Read docs/spec/tools.md
- [ ] Read docs/spec/permission.md
- [ ] Read docs/codebase-contract.md
- [ ] Confirmed codebase-contract matches actual code
- [ ] Recorded `npm run preflight` baseline, or explicitly justified reusing/skipping the full repo gate
- [ ] Stated scope and planned verification to the user

## Post-flight checklist
- [ ] Objective and acceptance criteria are satisfied
- [ ] Targeted verification ran and was recorded
- [ ] `npm run build && npm run test:all` passes
- [ ] No unintended file changes (git diff reviewed)
- [ ] Changes committed and pushed to `feat/tool-reliability`

## Notes
- Workspace root path is managed by workspace-service. Use it as the containment boundary for all write validation.
- For host-exec timeout, use `child_process.spawn` with a timer that calls `process.kill()`. Do not use `execSync`.
- Integration tests that write files should use a temp directory or clean up after themselves.
- The existing permission enforcement tests in integration.test.cjs should not break. Run the full suite to confirm.
