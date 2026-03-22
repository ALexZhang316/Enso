# AGENTS.md

## Internalized handoff

Project-internal documents are the active source of truth for this repository.
This file supplements the global AGENTS rules with repo-specific constraints.

## Read this repo in order

1. `AGENTS.md`
2. `docs/collaboration-protocol.md`
3. `docs/baseline.md`
4. `docs/architecture.md`
5. relevant files under `docs/spec/`
6. `docs/codebase-contract.md`
7. `docs/environment-and-github-bootstrap.md`
8. `CLAUDE.md` only if the active coding client actually reads `CLAUDE.md`

## Document authority by scope

### Product and architecture

Use these first for product identity, boundaries, and structural direction:
1. `docs/baseline.md`
2. `docs/architecture.md`

### Behavioral source of truth

All files under `docs/spec/` define the runtime and user-visible behavior contract:
- `brain.md` - execution flow, trace phases, verification contract
- `permission.md` - permission model, gate rules, confirmation behavior
- `context.md` - knowledge, retrieval, context assembly, and state persistence
- `tools.md` - tool orchestration, routing, and failure handling
- `ui.md` - shell layout and interaction behavior
- `audit.md` - audit event contract

If `AGENTS.md`, `CLAUDE.md`, review notes, or task files conflict with `docs/spec/*.md` on behavior, `docs/spec/*.md` wins.

### Collaboration protocol

`docs/collaboration-protocol.md` defines the Alex / Claude / Codex role split, review artifact rules, and handoff expectations.

### Code-layer contract

`docs/codebase-contract.md` records current directory structure, module ownership, schema, and known implementation issues.

### Reference and operational

- `docs/openclaw-reference-notes.md` - architectural extraction guide
- `docs/environment-and-github-bootstrap.md` - environment setup, native rebuild, GitHub init
- `docs/reviews/` - review artifacts
- `docs/handoffs/` - branch handoff documents

If uncertainty remains:
- choose the simpler implementation
- prefer stubs over speculative expansion
- do not add new product behavior

## Repo direction

This repository builds a local-first Windows desktop personal agent for one trusted operator.

The center of the product is:
- planner
- executor
- verifier
- tool registry
- task state
- permission boundary

## Non-negotiable product boundaries

Keep these:
- fixed three-panel desktop shell
- default mode always available
- optional manual modes: Deep Dialogue, Decision, Research
- no automatic mode routing
- planner -> executor -> verifier as the main execution backbone
- visible plan, trace, verification, and audit signals
- local config, session/state, audit, workspace, and knowledge metadata
- file import and a retrieval path
- typed bounded tools: read, search, compute, workspace-write, exec
- explicit permission boundaries for higher-risk actions

Do not introduce these:
- hidden side-effect execution
- uncontrolled autonomous loops
- messaging-channel expansion as a product pillar
- companion-persona framing as a product goal
- automatic long-term personality memory
- multi-agent product identity as a current priority
- product drift away from execution-first local task completion

Implementation details are flexible.
Product behavior is not.

## OpenClaw-aligned architecture rule

Borrow OpenClaw at the architecture level, not the product-shape level.

Keep:
- local control-plane thinking
- typed first-class tools
- workspace-centered execution
- explicit permission gates and approval boundaries
- visible execution trace and verification
- strict config validation

Do not copy:
- messaging-channel expansion
- companion persona framing
- social-surface product strategy
- omnipresence as product value
- multi-agent product identity for the current stage

In practice:
- prefer strengthening `planner -> executor -> verifier` over chat polish
- prefer explicit tool policy over vague improvisation
- prefer proposal, dry-run, or blocked results over hidden side effects

## Text encoding hygiene

- Keep repository text files in UTF-8.
- On Windows PowerShell, switch the session to UTF-8 before doc-heavy work or diff review:
  `. .\scripts\enable-utf8-terminal.ps1`
- Prefer ASCII punctuation in docs when equivalent text works well enough, for example use `->` in place of a Unicode arrow.

## Completion standard

Default completion standard for normal work:
- the requested objective is complete
- verification matches the touched surface
- no new in-scope regression remains unresolved
- unrelated pre-existing red checks are called out explicitly when relevant
- materially affected docs are updated

Do not force a release-style gate for every small task.
Do not claim more than your verification actually proves.

Use the full release or milestone gate only when claiming repo-wide health or release readiness.
That higher bar means all of the following are true:
- app launches
- three-panel UI works
- mode switching works, including return to default mode
- requests can be submitted and answered
- state, plan, and audit summaries are visible
- file import plus minimal retrieval are wired
- workspace exists and is used by the execution chain
- bounded tool execution runs end-to-end
- verifier can confirm basic artifact or result existence

## Workflow protocol

Follow the global execution model.
Within this repo, keep the work loop simple:

```text
PREFLIGHT -> PLAN -> WORK -> VERIFY -> POSTFLIGHT -> DONE
```

### PREFLIGHT

- Read the onboarding docs.
- For executable work, run `npm run preflight` unless you already have a recent baseline for the same branch and task context.
- For doc-only or workflow-contract changes, you may reuse a recent recorded baseline instead of rerunning the full repo gate, but say so explicitly.
- If preflight is already red because of known unrelated regressions, record that baseline and continue unless it blocks the requested task directly.

### PLAN

Define:
- objective
- in-scope and out-of-scope surfaces
- planned verification

Use an existing task file if it helps.
Create or update a task file only when it adds value, especially for multi-session work, material contract changes, or handoff-heavy tasks.

### VERIFY

- Match verification to the problem layer.
- Run the smallest sufficient checks for the actual claim you are making.
- If failures are within scope, repair them in the same session rather than stopping at the first red result.
- Use `npm run verify` when the change honestly needs repo-wide proof.
- Run `npm run test:ui` when desktop-shell stop-condition surfaces are meaningfully touched.

### POSTFLIGHT

- Update required docs proportionally to the real change.
- Run `npm run postflight` when broader verification is expected to pass or when claiming repo-wide health.
- If a known unrelated red baseline prevents full postflight from going green, run `node scripts/check-docs-updated.cjs`, review the diff, and report why full postflight is still red.

### DONE

Report:
- what changed
- what verification ran
- any remaining unrelated red baseline
- any residual risk or follow-up worth tracking

## Required document updates

After changes that materially affect behavior, limitations, workflow contract, or the codebase contract, update the relevant source-of-truth files before reporting completion:

- `CHANGELOG.md` for what changed and why
- `TODO_LIMITATIONS.md` for new or resolved limitations
- `docs/codebase-contract.md` for contract, module, schema, workflow, or known-issue drift

Also update these when they are directly affected:
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/collaboration-protocol.md`
- `docs/baseline.md`
- `docs/architecture.md`
- relevant files under `docs/spec/`

Do not force cosmetic updates when a file's actual source-of-truth content did not change.

## Task files

Task definitions live in `tasks/`.
Use `tasks/TEMPLATE.md` as the starting point.
The task index is `tasks/INDEX.md`.

Use task files when they improve continuity.
Do not create them as empty ceremony.

## When in doubt

1. Check `tasks/INDEX.md` for the active backlog.
2. If there is no assigned task, ask the user for the objective.
3. Choose the simpler implementation and the smallest honest verification.
4. Do not start coding without a clear objective and a credible verification plan.

## Fixed tech stack for the current stage

Unless there is a hard blocker, do not change the default stack.

- Desktop shell: Electron
- Frontend: React + TypeScript
- UI styling and components: Tailwind CSS + shadcn/ui
- LLM and retrieval glue layer: LangChain.js
- Local database access: better-sqlite3
- Local persistence target: SQLite
- User-editable config: TOML
- Model integration: provider abstraction with one provider first
- Knowledge and RAG: local ingestion plus chunking plus SQLite FTS retrieval, with vector or embedding work deferred
- Persistence scope: sessions, state, audit, workspace metadata, and knowledge metadata stored locally in SQLite

### Version locks

- Lock to a stable Node.js LTS release. Do not upgrade Node casually.
- Lock Electron to a stable major version for the current stage. Do not upgrade Electron casually.
- Do not swap better-sqlite3 out unless there is a real blocker.

### LangChain.js constraint

Use LangChain.js as an integration and orchestration helper only.
Do not let framework-default agent behavior replace the product-defined execution flow.
The execution flow spec remains the source of truth.

### Do not switch

Do not switch to Tauri, Next.js, YAML-first config, or a cloud-first architecture unless explicitly instructed.
