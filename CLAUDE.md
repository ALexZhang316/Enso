# CLAUDE.md

Claude-specific constraints supplement the shared project docs.
Only use this file when the active coding client actually reads `CLAUDE.md`.

## Reading order

1. `AGENTS.md` - repo-local workflow, authority by scope, product boundaries
2. `docs/collaboration-protocol.md` - role split, review rules, handoff expectations
3. `docs/baseline.md` - product identity and strategic direction
4. `docs/architecture.md` - component boundary map
5. relevant files under `docs/spec/` - behavioral source of truth
6. `docs/codebase-contract.md` - code-layer contract

For environment setup: `docs/environment-and-github-bootstrap.md`

## Collaboration role

In this repo's collaboration model:
- Claude owns specs, behavior rules, interface contracts, review artifacts, and design-consistency review
- Codex owns implementation, tests, integration, and verification
- Alex makes the final decision when there is a conflict or tradeoff

If behavior guidance in this file conflicts with `docs/spec/*.md`, `docs/spec/*.md` wins.

## Dev workflow enforcement

Before writing any code:
- Follow the global AGENTS execution model first.
- Read the shared repo docs first.
- For executable work, run `npm run preflight` and record the baseline unless you already have a recent baseline for the same branch and task context.
- For doc-only or workflow-contract changes, you may reuse a recent recorded baseline instead of rerunning the full repo gate, but say so explicitly.
- If preflight is already red because of known unrelated regressions, state that clearly and continue with scoped work unless the failure blocks the requested task directly.

Execution bias:
- Default to bounded autopilot once the objective, scope, and verification plan are clear.
- Continue through repeated cycles of inspect -> modify -> verify -> repair instead of stopping at the first local failure.
- Do not inflate straightforward tasks into extended planning or meta-document work unless the user explicitly asks.
- Do not pause for routine design forks, minor failures, or document churn.
- Only stop on hard blockers: missing access/credentials, ambiguous goals, irreversible high-risk side effects beyond the approved boundary, or environment failure that prevents progress.

After finishing code changes:
- Satisfy the repo's normal completion standard unless you are explicitly claiming repo-wide or release-level health.
- Run the smallest sufficient verification for the claim you are making.
- Run `npm run postflight` when broader verification is expected to pass or when claiming repo-wide or release-level health.
- If a known unrelated red baseline prevents full postflight from going green, run `node scripts/check-docs-updated.cjs`, review the diff, and report why full postflight remains red.
- The three core docs are: CHANGELOG.md, TODO_LIMITATIONS.md, docs/codebase-contract.md.
- Update them when the change materially affects behavior, limitations, or the codebase contract. Do not create cosmetic doc churn when nothing substantive changed.

Task lifecycle and detailed rules are in AGENTS.md.

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
