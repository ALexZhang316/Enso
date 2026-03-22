# Task 0003: Execution chain wiring

## Status
ready

## Ownership
- Decision owner: Alex
- Spec / review owner: Claude
- Implementation / integration owner: Codex

## Branch
`feat/exec-chain-wiring`

## Objective

Let the execution chain evolve from a constrained skeleton into a working request-processing pipeline. Wire expression config into the model system prompt, and constrain the model's structured execution draft to return a well-defined JSON format.

## Acceptance criteria
- [ ] `execution-flow.ts` reads expression config (density, structuredFirst, reportingGranularity) from the loaded config and passes it to the model adapter
- [ ] `model-adapter.ts` accepts expression parameters and uses them to adjust the system prompt wording (e.g. concise vs detailed, structured-first vs prose-first)
- [ ] The structured execution draft (canonical step 8) instructs the model to return JSON with fields: `answer`, `riskNotes`, `evidenceRefs`, `plannedTools`, `verificationTarget`, `needsConfirmation`
- [ ] If the model returns malformed JSON, the flow falls back gracefully (treats as plain text answer) instead of crashing
- [ ] New or updated integration tests cover: expression config injection, structured draft parsing, malformed-output fallback
- [ ] `npm run build && npm run test:all` passes

## Verification plan
- `npm run build` succeeds
- `npm run test:all` passes (unit + integration + UI)
- Manual: inspect the system prompt in a test to confirm expression params appear

## Spec references
- `docs/spec/brain.md` - 14-step canonical sequence, especially steps 7-8 (context assembly + structured draft)
- `docs/spec/context.md` - context assembly sources, minimal-sufficient-context target
- `docs/codebase-contract.md` - module ownership for execution-flow.ts and model-adapter.ts

## Files in scope
- `src/main/core/execution-flow.ts`
- `src/main/services/model-adapter.ts`
- `src/shared/types.ts` (only: add new interfaces at the end of the file)
- `tests/integration.test.cjs` (only: append new test cases at the end)

## Files out of scope
- `src/renderer/` (all renderer files)
- `src/main/providers/` (provider implementations)
- `src/main/services/tool-service.ts`
- `src/main/services/workspace-service.ts`
- `src/main/services/host-exec-service.ts`
- `docs/spec/` (do not modify specs)
- `CHANGELOG.md`, `TODO_LIMITATIONS.md`, `docs/codebase-contract.md` (shared docs, updated only by last branch to merge)

## Parallel merge rules
This branch merges **first** (before 0004 and 0005).
- Add new types to `src/shared/types.ts` at the **end** of the file. Do not reorganize existing types.
- Add new integration tests at the **end** of `tests/integration.test.cjs`. Do not reorganize existing tests.
- Do NOT update shared docs (CHANGELOG, TODO_LIMITATIONS, codebase-contract) -- the last branch to merge handles that.

## Pre-flight checklist
- [ ] Read AGENTS.md
- [ ] Read docs/collaboration-protocol.md
- [ ] Read docs/baseline.md
- [ ] Read docs/architecture.md
- [ ] Read docs/spec/brain.md
- [ ] Read docs/spec/context.md
- [ ] Read docs/codebase-contract.md
- [ ] Confirmed codebase-contract matches actual code
- [ ] Recorded `npm run preflight` baseline, or explicitly justified reusing/skipping the full repo gate
- [ ] Stated scope and planned verification to the user

## Post-flight checklist
- [ ] Objective and acceptance criteria are satisfied
- [ ] Targeted verification ran and was recorded
- [ ] `npm run build && npm run test:all` passes
- [ ] No unintended file changes (git diff reviewed)
- [ ] Changes committed and pushed to `feat/exec-chain-wiring`

## Notes
- Expression config is already persisted in TOML and loaded by config-service. The gap is that execution-flow.ts and model-adapter.ts don't read or use it yet.
- The structured draft JSON format is a new contract. Define a TypeScript interface for it and export from shared/types.ts.
- Keep the fallback simple: if JSON.parse fails, wrap the raw model output as a plain-text answer with empty metadata fields.
