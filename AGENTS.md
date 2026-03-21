# AGENTS.md

## Internalized handoff

The latest handoff pack has already been internalized into this repository.
Project-internal documents are the only active source of truth.
Do not rely on any external zip file during implementation or handoff.

Onboarding order:
1. `AGENTS.md`
2. `docs/current-baseline.md`
3. `docs/execution-flow.md`
4. `docs/codebase-contract.md`
5. `docs/environment-and-github-bootstrap.md`
6. `CLAUDE.md` if your client reads it

## Project summary

Build a local-first Windows desktop personal agent whose main value is solving complex desktop tasks under user control.

The app should provide:
- fixed three-panel main chat window
- optional manual mode switching on top of a default mode
- visible plan / execution / verification flow
- local config, local session/state, local audit
- file import
- minimal knowledge ingestion + retrieval
- local workspace
- bounded tool calling
- single-request execution flow defined in `docs/execution-flow.md`

This is a single-user system, not a generic SaaS product and not a social-channel assistant.

## Strategic intent

The product is now execution-first.
Dialogue remains supported, but does not define the product identity.
The core is:
- planner
- executor
- verifier
- tool registry
- task state
- permission boundary

## Hard constraints

- No automatic mode selection
- Default mode must exist even when no optional mode is enabled
- Deep Dialogue / Decision / Research are mutually exclusive optional modes
- These modes bias behavior; they are not separate engines or product identities
- No social / messaging channel integrations as a product pillar
- No companion persona as a product goal
- No automatic long-term personality memory
- No multi-agent system as a current priority
- No hidden side-effect execution
- No uncontrolled autonomous loops
- Do not drift beyond the execution-first product boundary

## Behavior constraints

Implementation details are flexible. Product behavior is not.

You may choose:
- internal function/module structure
- naming
- storage wrappers
- UI component decomposition
- stub strategy

You may not change:
- single-user local-first assumption
- main request flow
- execution-first product direction
- read-visible and permission-gated action principle
- requirement for visible state and auditability
- default mode + mutually exclusive optional mode behavior

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

## Source documents

Use these files as the source of truth:

1. `docs/current-baseline.md`
2. `docs/execution-flow.md`
3. `docs/windows-product-spec.md`
4. `docs/architecture.md`
5. `docs/module-spec-table.md`
6. `docs/ui-layout.md`
7. `docs/iteration-guidance.md`
8. `docs/revision-notes-2026-03-09.md`
9. `docs/openclaw-reference-notes.md`

If uncertainty remains:
- choose the simpler implementation
- prefer stubs over speculative expansion
- do not add new product behavior

Operational bootstrap:
- use `docs/environment-and-github-bootstrap.md` for environment setup, native rebuild prerequisites, and GitHub initialization when `.git` is missing

## Text encoding hygiene

- Keep repository text files in UTF-8.
- On Windows PowerShell, switch the session to UTF-8 before doc-heavy work or diff review:
  `. .\scripts\enable-utf8-terminal.ps1`
- Prefer ASCII punctuation in docs when equivalent text works well enough, for example use `->` in place of a Unicode arrow.

## Preserve in ongoing iterations

- Windows desktop main window shell
- fixed 3-panel layout
- default mode + manual optional mode switching
- local conversation/session basics
- local config read/write with validation
- local state persistence
- audit summary persistence + display
- local workspace root
- file import
- retrieval path
- typed tool abstraction: read / search / compute / workspace-write / exec
- planner -> executor -> verifier main chain
- visible task state and latest execution trace

## Stop conditions

A change is not acceptable unless all are true:

- app launches
- three-panel UI works
- mode switching works, including return to default mode
- requests can be submitted and answered
- state, plan, and audit summaries are visible
- file import + minimal retrieval are wired
- workspace exists and is used by the execution chain
- bounded tool execution runs end-to-end
- verifier can confirm basic artifact/result existence

## Dev workflow protocol

Every coding session must follow this lifecycle:

```
PREFLIGHT -> PLAN -> EXECUTE -> VERIFY -> POSTFLIGHT -> DONE
```

### Phase details

1. **PREFLIGHT**: Read onboarding docs (AGENTS.md, current-baseline, execution-flow, codebase-contract). Run `npm run preflight`. Confirm understanding to user. Do not write code until preflight passes.
2. **PLAN**: Define scope and acceptance criteria. If a task file exists in `tasks/`, fill in the fields. If not, state the plan verbally or create a task file.
3. **EXECUTE**: Implement changes.
4. **VERIFY**: Run `npm run verify`. Check each acceptance criterion.
5. **POSTFLIGHT**: Update the three mandatory docs (see below). Run `npm run postflight` and address any warnings. Review `git diff` for unintended changes.
6. **DONE**: All checklists complete. Task file status set to `done` if applicable.

### Mandatory post-flight document updates

After ANY code change, you MUST update these three files before reporting completion:

- `CHANGELOG.md` -- what changed and why
- `TODO_LIMITATIONS.md` -- any new limitations or resolved items
- `docs/codebase-contract.md` -- directory structure, module registry, schema, known issues, decisions

Failure to update these documents is a defect equivalent to a broken build.

### Task files

Task definitions live in `tasks/`. Use `tasks/TEMPLATE.md` as the starting point.
The task index is `tasks/INDEX.md`.

### When in doubt

1. Check `tasks/INDEX.md` for the current backlog
2. If no task is assigned, ask the user
3. Do not start coding without a clear objective and acceptance criteria

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
- Persistence scope: sessions, state, audit, workspace metadata, and knowledge metadata stored locally in SQLite

### Version locks
- Lock to a stable Node.js LTS release. Do not upgrade Node casually.
- Lock Electron to a stable major version for the current stage. Do not upgrade Electron casually.
- Do not swap better-sqlite3 out unless there is a real blocker.

### LangChain.js constraint
Use LangChain.js as an integration/orchestration helper only.
Do not let framework-default agent behavior replace the product-defined execution flow.
The execution flow spec remains the source of truth.

### Do not switch
Do not switch to Tauri, Next.js, YAML-first config, or a cloud-first architecture unless explicitly instructed.
