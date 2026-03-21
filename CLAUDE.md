# CLAUDE.md

## Internalized handoff

This repository already contains the active handoff set.
Project-internal documents are the only active source of truth.
Do not rely on any external zip file during implementation or handoff.

Read in this order before making changes:
1. `AGENTS.md`
2. `docs/current-baseline.md`
3. `docs/execution-flow.md`
4. `docs/codebase-contract.md`
5. `docs/environment-and-github-bootstrap.md`

Use this file after the shared project docs for Claude-specific constraints.

## Project context

This repository contains a single-user local-first Windows desktop personal agent.

Primary goal:
- solve real local tasks under strong user control

Supported interaction posture:
- default mode always available
- optional manual modes: Deep Dialogue / Decision / Research

These modes are behavior biases, not the product identity.
The product identity is an execution-first personal agent.

The product is intentionally narrow. It is not:
- a generic AI portal
- a multi-agent framework
- a social-channel assistant
- a companion persona shell
- a SaaS shell

## Dev workflow enforcement

Before writing any code:
- Run `npm run preflight` and confirm it passes.

Execution bias:
- Default to bounded autopilot once the objective, scope, and stop condition are clear.
- Continue through repeated cycles of inspect -> modify -> verify -> repair instead of stopping at the first local failure.
- Do not inflate straightforward tasks into extended planning or meta-document work unless the user explicitly asks.
- If preflight is already red because of known unrelated regressions, record that baseline and continue with scoped work unless the failure blocks the requested task directly.
- Do not pause for routine design forks, minor failures, or document churn.
- Only stop on hard blockers: missing access/credentials, ambiguous goals, irreversible high-risk side effects beyond the approved boundary, or environment failure that prevents progress.

After finishing code changes:
- Run `npm run postflight` and address any warnings.
- If postflight warns about un-updated docs, update them before considering the task done.
- The three core docs are: CHANGELOG.md, TODO_LIMITATIONS.md, docs/codebase-contract.md.
- Update them when the change materially affects behavior, limitations, or the codebase contract. Do not create cosmetic doc churn when nothing substantive changed.

Task lifecycle and detailed rules are in the "Dev workflow protocol" section of AGENTS.md.

## Implementation rules

Follow the markdown docs under `docs/`.

When docs conflict, use:
1. `docs/current-baseline.md`
2. `docs/execution-flow.md`
3. `docs/windows-product-spec.md`
4. `docs/architecture.md`
5. `docs/module-spec-table.md`
6. `docs/ui-layout.md`
7. `docs/iteration-guidance.md`
8. `docs/revision-notes-2026-03-09.md`
9. `docs/openclaw-reference-notes.md`

For environment setup, native rebuild prerequisites, and GitHub initialization when `.git` is missing, use:
- `docs/environment-and-github-bootstrap.md`

## Text encoding hygiene

- Keep repository text files in UTF-8.
- On Windows PowerShell, switch the session to UTF-8 before doc-heavy work or diff review:
  `. .\scripts\enable-utf8-terminal.ps1`
- Prefer ASCII punctuation in docs when equivalent text works well enough, for example use `->` in place of a Unicode arrow.

## Constraints you must preserve

- No automatic mode switching
- Default mode must exist without explicit user selection
- Deep Dialogue / Decision / Research are mutually exclusive optional modes
- Do not confuse user-facing Decision mode with the system's internal decision logic
- No messaging-channel sprawl as a product direction
- No nonlinear conversation expansion as a current priority
- No auto-growing long-term personality memory
- No hidden side-effect actions
- Keep actions permission-gated and auditable
- Keep execution flow explicit and inspectable
- Keep tool access bounded and user-legible

## OpenClaw-aligned execution rule

Enso should borrow OpenClaw at the architecture level, not the product-shape level.

Must borrow:
- local control-plane thinking
- typed first-class tools
- workspace-centered execution
- explicit permission gate and approval boundary
- visible execution trace and verification
- strict config validation

Must not borrow:
- messaging-channel expansion
- companion persona framing
- social-surface product strategy
- omnipresence as product value
- multi-agent product identity for the current stage

Implementation consequence:
- prefer strengthening `planner -> executor -> verifier` over adding more chat polish
- prefer explicit tool policy over vague agent-like improvisation
- prefer proposal / dry-run / blocked result over hidden side effects

## What to optimize for

- reliability over charm
- replaceable structure over premature abstraction
- stable execution core over broad feature surface
- visible state, plan, and verification
- local ownership of config, state, logs, workspace, and knowledge orchestration

## Preserve or strengthen in future iterations

- runnable Windows desktop app skeleton
- fixed 3-panel UI
- default mode + manual optional mode switcher
- local config/state/audit persistence
- local workspace root
- file import entry
- minimal knowledge ingestion + retrieval
- one reliable single-request chain
- bounded workspace write/exec path
- visible execution trace
- README
- TODO/LIMITATIONS

## Fixed tech stack for the current stage

Unless there is a hard blocker, do not change the default stack.

- Desktop shell: Electron
- Frontend: React + TypeScript
- UI styling/components: Tailwind CSS + shadcn/ui
- LLM / retrieval glue layer: LangChain.js
- Local database access: better-sqlite3
- Local persistence target: SQLite
- User-editable config: TOML
- Model integration: provider abstraction with one provider first
- Knowledge/RAG: local ingestion + chunking + SQLite FTS retrieval (vector/embedding deferred)
- Persistence scope: sessions, state, audit, workspace metadata, and knowledge metadata all stored locally in SQLite

### Version locks
- Lock to a stable Node.js LTS release. Do not upgrade Node casually.
- Lock Electron to a stable major version for the current stage. Do not upgrade Electron casually.
- Do not swap better-sqlite3 out unless there is a real blocker.

### LangChain.js constraint
Use LangChain.js as an integration/orchestration helper only.
Do not let framework-default agent behavior replace the product-defined execution flow.
