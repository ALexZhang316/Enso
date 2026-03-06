# CLAUDE.md

## Project context

This repository contains a single-user local-first Windows desktop personal agent.

Primary modes:
- Deep Dialogue (default)
- Decision
- Research

The product is intentionally narrow. It is not:
- a generic AI portal
- a multi-agent framework
- a coding copilot
- a SaaS shell

## Implementation rules

Follow the markdown docs under `docs/`.

When docs conflict, use:
1. `docs/mvp-definition.md`
2. `docs/execution-flow.md`
3. `docs/ui-layout.md`
4. `docs/windows-product-spec.md`
5. `docs/architecture.md`
6. `docs/module-spec-table.md`

## Constraints you must preserve

- No automatic routing
- No automatic mode switching
- No nonlinear conversation features in MVP
- No auto-growing long-term memory
- No vibecoding mode
- No hidden side-effect actions
- Keep read-only as the default behavior
- Keep the execution flow explicit and auditable

## What to optimize for

- clarity over cleverness
- replaceable structure over premature abstraction
- stable MVP shell over broad feature surface
- visible state and auditability
- local ownership of config, state, logs, and knowledge orchestration

## First-round deliverables

- runnable Windows desktop app skeleton
- fixed 3-panel UI
- manual mode switcher
- local config/state/audit persistence
- file import entry
- minimal knowledge ingestion + retrieval
- one working single-request chain
- README
- TODO/LIMITATIONS

## Fixed tech stack for v0.1

Unless there is a hard blocker, do not change the default stack.

- Desktop shell: Electron
- Frontend: React + TypeScript
- UI styling/components: Tailwind CSS + shadcn/ui
- LLM / retrieval glue layer: LangChain.js
- Local database access: better-sqlite3
- Local persistence target: SQLite
- User-editable config: TOML
- Model integration: provider abstraction with one OpenAI-compatible chat provider first
- Knowledge/RAG: local ingestion + chunking + embeddings + SQLite-backed metadata
- Persistence scope: sessions, state, audit, and knowledge metadata all stored locally in SQLite

### Version locks
- Lock to a stable Node.js LTS release. Do not upgrade Node casually.
- Lock Electron to a stable major version for v0.1. Do not upgrade Electron casually.
- Do not swap better-sqlite3 out unless there is a real blocker.

### LangChain.js constraint
Use LangChain.js as an integration/orchestration helper only.
Do not let framework-default agent behavior replace the product-defined execution flow.
The execution flow spec remains the source of truth.

### Do not switch
Do not switch to Tauri, Next.js, YAML-first config, or a cloud-first architecture unless explicitly instructed.


## Notes

Use stubs where needed, but mark them clearly.
Do not silently invent product behavior that is not specified.
