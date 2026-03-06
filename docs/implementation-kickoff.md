# Implementation Kickoff Brief v0.1

## Purpose

Translate the agreed design docs into a constrained first implementation task for Codex / Claude Code.

Core rule:
coding agents may choose implementation details, but they may not change product behavior, scope, or execution flow.

## This round: target outcome

Build a runnable Windows desktop main-window MVP skeleton.

The app must support:
- fixed three-panel layout
- manual mode switching
- local config
- local session/state
- audit summary
- file import
- minimal knowledge retrieval
- the main single-request execution path

## Source documents

Use as source of truth:
1. architecture.md
2. windows-product-spec.md
3. module-spec-table.md
4. mvp-definition.md
5. ui-layout.md
6. execution-flow.md

Priority when docs conflict:
MVP Definition > Single Request Execution Flow > Windows UI Layout Spec > Windows Desktop Product Spec > System Architecture > Module Spec Table

If uncertainty remains:
- choose the simpler, more conservative implementation
- use stubs instead of inventing new product behavior

## Product boundary

- single-user Windows desktop app
- main chat window form factor
- local-first architecture
- Deep Dialogue default entry mode
- Decision and Research as secondary modes
- no automatic routing

Not:
- general SaaS product
- IDE / vibecoding tool
- multi-agent platform

## Must build in this round

- Windows main window shell
- mode switching
- session basics
- local config
- local state
- audit summary
- file import + knowledge entry
- minimal retrieval
- tool abstraction
- single request main chain

## Explicitly out of scope

- automatic routing / mode selection
- nonlinear conversation
- automatic long-term memory
- multi-agent orchestration
- vibecoding mode
- complex connectors and automation scheduling
- external side-effect execution
- advanced permission UI
- heavy onboarding / recommendations

## Hard flow constraints

The main order must remain:

1. User input
2. Read current mode
3. Load local config
4. Read current session state
5. Decide whether retrieval is needed
6. Decide whether tools are needed
7. Assemble context
8. Call model adapter
9. Produce result
10. Write state
11. Write audit summary
12. Update UI

Allowed freedom:
- internal function structure
- module boundaries
- naming
- storage wrappers
- UI component decomposition

Not allowed:
- changing product behavior
- inventing autonomy beyond the agreed flow

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


## Stubs are allowed here

- advanced vector retrieval
- web search provider integration
- full compute capabilities
- advanced permission levels
- rich audit viewer
- research-mode citation UX
- background profile loading
- multiple model providers

Any stub must run, be clearly marked, and not pretend to be production-complete.

## Required deliverables

- runnable Windows desktop application skeleton
- fixed three-panel UI
- manual switching among Deep Dialogue / Decision / Research
- local config file plus read/write logic
- local session / state / audit persistence
- file import entry
- minimal knowledge ingestion and retrieval path
- one working single-request execution chain
- README
- TODO / LIMITATIONS

## Stop conditions

Stop when all are true:
- app launches
- three-panel UI works
- three modes switch correctly
- users can create/switch conversations and submit requests
- state and audit summaries are visible
- file import and minimal retrieval are wired into the flow
- the main single-request path runs end-to-end

Do not keep expanding after these conditions are met.
