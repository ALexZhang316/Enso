# Task 0005: UI cleanup and panel wiring

## Status
ready

## Ownership
- Decision owner: Alex
- Spec / review owner: Claude
- Implementation / integration owner: Codex

## Branch
`feat/ui-cleanup-panels`

## Objective

Fix known garbled text in shared type definitions, wire right-rail panels to real state data, and complete the confirmation interaction flow in the center panel.

## Acceptance criteria
- [ ] All garbled/mojibake text in `src/shared/modes.ts` and `src/shared/types.ts` is replaced with clean English or Chinese
- [ ] Right-rail panels (plan, trace, verification, audit summary) in `RightPanel.tsx` display real data from the state snapshot received via IPC, not placeholder text
- [ ] Right-rail panels refresh automatically when a new state snapshot arrives (after each request completes)
- [ ] Confirmation flow in `CenterPanel.tsx` works end-to-end: user clicks confirm button -> IPC call to main process -> result message appears in chat
- [ ] Confirmation rejection (user clicks reject/cancel) also works and shows a rejection message
- [ ] Updated or new UI tests in `tests/ui.test.cjs` cover: panel data rendering, confirmation accept, confirmation reject
- [ ] `npm run build && npm run test:all` passes

## Verification plan
- `npm run build` succeeds
- `npm run test:all` passes
- `npm run test:ui` specifically passes with the new/updated UI tests
- Manual: inspect modes.ts and types.ts to confirm no garbled text remains

## Spec references
- `docs/spec/ui.md` - three-column layout, right rail 8 panels, confirmation interaction rules, startup state
- `docs/codebase-contract.md` - renderer contract, shared contract layer

## Files in scope
- `src/shared/modes.ts` (fix garbled text)
- `src/shared/types.ts` (fix garbled text only, do NOT add new types -- 0003/0004 handle that)
- `src/renderer/components/RightPanel.tsx`
- `src/renderer/components/CenterPanel.tsx`
- `src/renderer/App.tsx` (only if state-passing props need adjustment)
- `src/renderer/lib/labels.ts` (only if label mappings need cleanup)
- `tests/ui.test.cjs` (new or extended test cases)

## Files out of scope
- `src/main/core/execution-flow.ts`
- `src/main/services/` (all service files)
- `src/main/providers/` (provider implementations)
- `tests/integration.test.cjs` (owned by 0003/0004)
- `docs/spec/` (do not modify specs)

## Parallel merge rules
This branch merges **last** (after 0003 and 0004).
- Changes to `src/shared/types.ts` are limited to fixing garbled text. Do not add new types.
- `src/shared/modes.ts` is exclusive to this branch.
- This branch does NOT touch `tests/integration.test.cjs`.
- **This branch is responsible for updating shared docs after merge**: `CHANGELOG.md`, `TODO_LIMITATIONS.md`, `docs/codebase-contract.md`, covering all three branches' changes.

## Pre-flight checklist
- [ ] Read AGENTS.md
- [ ] Read docs/collaboration-protocol.md
- [ ] Read docs/baseline.md
- [ ] Read docs/architecture.md
- [ ] Read docs/spec/ui.md
- [ ] Read docs/codebase-contract.md
- [ ] Confirmed codebase-contract matches actual code
- [ ] Recorded `npm run preflight` baseline, or explicitly justified reusing/skipping the full repo gate
- [ ] Stated scope and planned verification to the user

## Post-flight checklist
- [ ] Objective and acceptance criteria are satisfied
- [ ] Targeted verification ran and was recorded
- [ ] `npm run build && npm run test:all` passes
- [ ] No unintended file changes (git diff reviewed)
- [ ] Changes committed and pushed to `feat/ui-cleanup-panels`

## Notes
- The garbled text in modes.ts and types.ts is a known issue recorded in codebase-contract.md. Fix it by reading the surrounding context to infer the intended meaning, then write clean text.
- RightPanel currently receives props from App.tsx. Check the current prop interface to understand what state data is already available vs what needs to be added.
- The IPC channel for confirmation resolution should already exist (used by the permission boundary rework). Verify it works before building new UI around it.
- UI tests run via Playwright against the built Electron app. Keep test assertions stable and avoid timing-sensitive checks.
