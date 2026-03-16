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
- Knowledge/RAG: local ingestion + chunking + embeddings + SQLite-backed metadata
- Persistence scope: sessions, state, audit, workspace metadata, and knowledge metadata all stored locally in SQLite

### Version locks
- Lock to a stable Node.js LTS release. Do not upgrade Node casually.
- Lock Electron to a stable major version for the current stage. Do not upgrade Electron casually.
- Do not swap better-sqlite3 out unless there is a real blocker.

### LangChain.js constraint
Use LangChain.js as an integration/orchestration helper only.
Do not let framework-default agent behavior replace the product-defined execution flow.
