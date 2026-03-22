# Task Index

| ID   | Title                          | Status | Branch                   | Merge order | Assigned     | Date       |
|------|--------------------------------|--------|--------------------------|-------------|--------------|------------|
| 0002 | Permission boundary rework     | done   | -                        | -           | Codex (impl), Claude (spec) | 2026-03-21 |
| 0003 | Execution chain wiring         | ready  | `feat/exec-chain-wiring` | 1st         | Codex (impl), Claude (spec) | 2026-03-23 |
| 0004 | Tool reliability               | ready  | `feat/tool-reliability`  | 2nd         | Codex (impl), Claude (spec) | 2026-03-23 |
| 0005 | UI cleanup and panel wiring    | ready  | `feat/ui-cleanup-panels` | 3rd (last)  | Codex (impl), Claude (spec) | 2026-03-23 |

## Parallel execution notes

- Each task has its own branch and worktree. Codex creates branches and worktrees.
- Merge order: 0003 -> 0004 -> 0005. Each branch rebases onto main before merging.
- Shared files (`CHANGELOG.md`, `TODO_LIMITATIONS.md`, `docs/codebase-contract.md`) are updated only by the last branch (0005).
- `src/shared/types.ts`: 0003 and 0004 append new types at end; 0005 only fixes garbled text.
- `tests/integration.test.cjs`: 0003 and 0004 append new tests at end; 0005 does not touch it.
