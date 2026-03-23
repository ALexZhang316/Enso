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
5. Relevant files under `docs/spec/`
6. `docs/codebase-contract.md`
7. `docs/environment-and-github-bootstrap.md`

## Document authority

### Product and architecture

1. `docs/baseline.md`
2. `docs/architecture.md`

### Behavioral source of truth

All files under `docs/spec/` define the runtime and user-visible behavior contract:
- `brain.md` - execution flow, trace phases, verification
- `permission.md` - permission model, gate rules, confirmation
- `context.md` - knowledge, retrieval, context assembly, state
- `tools.md` - tool orchestration, routing, failure handling
- `ui.md` - shell layout and interaction
- `audit.md` - audit event contract

If this file conflicts with `docs/spec/*.md` on behavior, `docs/spec/*.md` wins.

### Collaboration

`docs/collaboration-protocol.md` defines the role split and review rules.

### Code-layer contract

`docs/codebase-contract.md` records directory structure, module ownership, schema, and known issues.

### Reference

- `docs/openclaw-reference-notes.md` - architectural extraction guide
- `docs/environment-and-github-bootstrap.md` - environment setup
- `docs/reviews/` - review artifacts
- `docs/handoffs/` - branch handoff documents

If uncertainty remains:
- Choose the simpler implementation
- Prefer stubs over speculative expansion
- Do not add new product behavior

## Product boundaries (non-negotiable)

Keep these:
- Fixed three-panel desktop shell
- Default mode always available
- Optional manual modes: Deep Dialogue, Decision, Research
- No automatic mode routing
- planner -> executor -> verifier as the main execution backbone
- Visible plan, trace, verification, and audit signals
- Local config, session/state, audit, workspace, and knowledge metadata
- File import and a retrieval path
- Typed bounded tools: read, search, compute, workspace-write, exec
- Explicit permission boundaries for higher-risk actions

Do not introduce these:
- Hidden side-effect execution
- Uncontrolled autonomous loops
- Messaging-channel expansion as a product pillar
- Companion-persona framing as a product goal
- Automatic long-term personality memory
- Multi-agent product identity as a current priority
- Product drift away from execution-first local task completion

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
- App launches, three-panel UI works, mode switching works
- Requests can be submitted and answered
- State, plan, and audit summaries visible
- File import plus retrieval wired
- Workspace used by the execution chain
- Bounded tool execution end-to-end
- Verifier confirms basic artifact existence

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
- LangChain.js (orchestration only)
- better-sqlite3 + SQLite, TOML config
- Node.js 20.x LTS, Electron stable major
- Do not switch to Tauri, Next.js, YAML, or cloud-first architecture unless instructed.

## File protection

- Codex must not modify `CLAUDE.md`. Proposed changes go through Claude review and Alex approval.
- Claude must not modify this file (`AGENTS.md`). Proposed changes go through Codex review and Alex approval.
- Neither agent may modify `docs/collaboration-protocol.md` without Alex's explicit approval.
