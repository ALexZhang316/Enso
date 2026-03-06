# AGENTS.md

## Project summary

Build a local-first Windows desktop personal-agent MVP skeleton with:

- fixed three-panel main chat window
- manual mode switching: Deep Dialogue / Decision / Research
- local config, local session/state, local audit
- file import entry
- minimal knowledge ingestion + retrieval
- single-request execution flow defined in `docs/execution-flow.md`

This is a single-user system, not a generic SaaS product.

## Hard constraints

- No auto-routing
- No auto mode selection
- No nonlinear conversation / canvas / branching in MVP
- No automatic long-term memory
- No vibecoding mode
- No multi-agent system
- No external side-effect execution
- Do not expand beyond MVP scope

## Behavior constraints

Implementation details are flexible. Product behavior is not.

You may choose:
- internal function/module structure
- naming
- storage wrappers
- UI component decomposition
- stub strategy

You may not change:
- mode system
- main request flow
- product scope
- local-first control-plane assumption
- read-only default and gated-action principle

## Source documents

Use these files as the source of truth:

1. `docs/mvp-definition.md`
2. `docs/execution-flow.md`
3. `docs/ui-layout.md`
4. `docs/windows-product-spec.md`
5. `docs/architecture.md`
6. `docs/module-spec-table.md`
7. `docs/implementation-kickoff.md`

If uncertainty remains:
- choose the simpler implementation
- prefer stubs over speculative expansion
- do not add new product behavior

## Must build in the first round

- Windows desktop main window shell
- fixed 3-panel layout
- manual mode switching
- local conversation/session basics
- local config read/write
- local state persistence
- audit summary persistence + display
- file import
- minimal retrieval path
- minimal tool abstraction: read / search / compute
- single-request execution main chain

## Stop conditions

Stop the round when all are true:

- app launches
- three-panel UI works
- modes switch
- requests can be submitted and answered
- state and audit summaries are visible
- file import + minimal retrieval are wired
- the main single-request flow runs end-to-end

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

