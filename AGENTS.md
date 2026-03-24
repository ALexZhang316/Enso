# AGENTS.md

This file is the operational manual for implementation agents (primarily Codex).
It defines strict workflow rules, verification gates, and file-boundary constraints.
It is independent of CLAUDE.md. Do not merge, synchronize, or defer to CLAUDE.md.

## Who this file is for

This file governs agents that write code, run tests, and verify integration.
In the current collaboration model, that means Codex / GPT-5.4.

Claude has its own role definition in CLAUDE.md and is not bound by the workflow
protocol in this file.

## Reading order for implementation work

Before writing any code, read these in order:

1. This file (`AGENTS.md`)
2. `docs/collaboration-protocol.md`
3. `docs/baseline.md`
4. `docs/architecture.md`
5. `docs/codebase-contract.md`
7. `docs/environment-and-github-bootstrap.md`

## Document authority

### Product and architecture

1. `docs/baseline.md`
2. `docs/architecture.md`

### Behavioral source of truth

`docs/baseline.md` and `docs/architecture.md` define the product identity and runtime architecture.

If this file conflicts with those documents on behavior, they win.

### Collaboration

`docs/collaboration-protocol.md` defines the role split and review rules.

### Code-layer contract

`docs/codebase-contract.md` records directory structure, module ownership, schema, and known issues.

### Reference

- `docs/environment-and-github-bootstrap.md` - environment setup
- `docs/reviews/` - review artifacts
- `docs/handoffs/` - branch handoff documents

If uncertainty remains:
- Choose the simpler implementation
- Prefer stubs over speculative expansion
- Do not add new product behavior

## Product boundaries (non-negotiable)

Keep these:
- Two-column desktop shell (left panel + center panel)
- Three boards: dialogue, decision, research — mutually exclusive, user-selected
- No automatic board switching or routing
- No "default mode"
- Streaming text generation via Vercel AI SDK
- Local config, session/state persistence
- Per-provider model and API key configuration

Do not introduce these:
- Hidden side-effect execution
- Uncontrolled autonomous loops
- Messaging-channel expansion as a product pillar
- Companion-persona framing as a product goal
- Automatic long-term personality memory
- Audit, permission gate, or verification systems
- Planner/executor/verifier execution pipeline

Implementation details are flexible. Product behavior is not.

## Workflow protocol

Follow this loop strictly for every implementation task:

```text
PREFLIGHT -> PLAN -> WORK -> VERIFY -> POSTFLIGHT -> DONE
```

### PREFLIGHT

- Read the docs listed in the reading order above.
- For executable work, run `npm run preflight` unless you have a recent baseline for the same branch and task.
- For doc-only changes, you may reuse a recent baseline, but say so explicitly.
- If preflight is red from known unrelated regressions, record that and continue unless it blocks the task.

### PLAN

Define:
- Objective
- In-scope and out-of-scope files
- Planned verification

Use an existing task file if one exists. Create or update a task file when it adds value.

### WORK

- Read all in-scope files before modifying anything.
- Stay within the declared file scope. Do not touch out-of-scope files.
- Build after each meaningful change: `npm run build`.
- Fix build failures immediately before proceeding.
- Do not add features beyond the acceptance criteria.

### VERIFY

- Run `npm run build && npm run test:all && npm run lint`.
- If failures are in scope, repair them in the same session (up to 3 cycles).
- Do not claim success if verification is not green.
- Match verification to the problem layer. Use `npm run test:ui` when UI surfaces are touched.

### POSTFLIGHT

- Update these three core docs when materially affected:
  - `CHANGELOG.md` for what changed and why
  - `TODO_LIMITATIONS.md` for new or resolved limitations
  - `docs/codebase-contract.md` for contract, module, schema, or known-issue drift
- Run `node scripts/check-docs-updated.cjs` to verify.
- Update the task file status and `tasks/INDEX.md`.
- Do not create cosmetic doc churn.

### DONE

Report:
- What changed
- What verification ran and the results
- Any remaining unrelated red baseline
- Any residual risk or follow-up

## Completion standard

Default:
- Objective complete
- Verification matches the touched surface
- No new in-scope regression
- Materially affected docs updated

Release/milestone gate (only when claiming repo-wide health):
- App launches, two-column UI works, board switching works
- Messages can be sent and streamed back
- Conversations can be created, selected, renamed, deleted per board
- Model/provider selection works
- Settings page with API key management works

Do not force the release gate for every small task.
Do not claim more than your verification proves.

## Task files

Task definitions live in `tasks/`. Use `tasks/TEMPLATE.md` as the starting point.
The task index is `tasks/INDEX.md`.

## Text encoding

- Keep repository text files in UTF-8.
- On Windows PowerShell: `. .\scripts\enable-utf8-terminal.ps1`
- Prefer ASCII punctuation in docs.

## Tech stack (locked)

- Electron, React + TypeScript, Tailwind CSS + shadcn/ui
- Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`)
- better-sqlite3 + SQLite, TOML config
- Node.js 20.x LTS, Electron stable major
- Do not switch to Tauri, Next.js, YAML, or cloud-first architecture unless instructed.

## File protection

- Codex must not modify `CLAUDE.md`. Proposed changes go through Claude review and Alex approval.
- Claude must not modify this file (`AGENTS.md`). Proposed changes go through Codex review and Alex approval.
- Neither agent may modify `docs/collaboration-protocol.md` without Alex's explicit approval.
