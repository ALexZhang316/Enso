# Task 0001: Dev workflow system

## Status
done

## Assigned model
Claude Code

## Objective
Build a lightweight, file-based development workflow system to prevent AI models from skipping mandatory documentation updates and to provide a structured task lifecycle (preflight -> plan -> execute -> verify -> postflight -> done).

## Acceptance criteria
- [x] tasks/ directory exists with TEMPLATE.md and INDEX.md
- [x] scripts/check-docs-updated.cjs checks for mandatory doc changes
- [x] npm scripts added: preflight, verify, postflight
- [x] AGENTS.md updated with dev workflow protocol section
- [x] CLAUDE.md updated with dev workflow enforcement section
- [x] codebase-contract.md handoff checklist updated
- [x] npm run build passes
- [x] npm run test:mvp passes
- [x] npm run postflight passes with no warnings

## Files in scope
- tasks/TEMPLATE.md (new)
- tasks/INDEX.md (new)
- tasks/0001-dev-workflow-system.md (new, this file)
- scripts/check-docs-updated.cjs (new)
- package.json (modify - add 3 scripts)
- AGENTS.md (modify - add dev workflow protocol)
- CLAUDE.md (modify - add dev workflow enforcement)
- docs/codebase-contract.md (modify - update handoff checklist)
- CHANGELOG.md (modify - record this round)
- TODO_LIMITATIONS.md (modify - if needed)

## Files out of scope
- src/** (no code changes)
- tests/** (no test changes)

## Pre-flight checklist
- [x] Read AGENTS.md
- [x] Read docs/current-baseline.md
- [x] Read docs/execution-flow.md
- [x] Read docs/codebase-contract.md
- [x] Confirmed codebase-contract matches actual code
- [x] `npm run preflight` passes
- [x] Stated understanding to user

## Post-flight checklist
- [x] `npm run verify` passes (build + tests)
- [x] CHANGELOG.md updated
- [x] TODO_LIMITATIONS.md updated
- [x] docs/codebase-contract.md updated
- [x] `npm run postflight` passes (no warnings)
- [x] No unintended file changes (git diff reviewed)

## Notes
This task was triggered by the user noticing that the previous coding round forgot to update mandatory docs (CHANGELOG, TODO_LIMITATIONS, codebase-contract) until explicitly asked. The workflow system prevents this by making doc updates a mandatory postflight gate.
