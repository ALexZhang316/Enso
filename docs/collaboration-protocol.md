# Collaboration Protocol v0.3.4

## Purpose

This file records the agreed collaboration contract between:
- Alex as the human decision maker
- Claude Code / Opus as the spec and review owner
- Codex / GPT-5.4 as the implementation and integration owner

This is a repo-internal operational document.
It exists so the collaboration rules do not live only in chat history or on a desktop note outside the repository.

## Authority

- On collaboration, ownership, review, and handoff questions, this file wins over `AGENTS.md` and `CLAUDE.md`.
- On product identity and architectural boundaries, use `docs/baseline.md` and `docs/architecture.md`.
- On runtime behavior and user-visible contract, `docs/spec/*.md` is the source of truth.
- On code structure, schema, and current implementation notes, use `docs/codebase-contract.md`.

## Roles

| Role | Owner | Responsibility boundary |
|------|-------|--------------------------|
| Decision maker | Alex | Final decisions on conflicts, priorities, tradeoffs, and direction |
| Spec and review | Claude Code / Opus | Specs, behavior rules, state machines, acceptance criteria, design consistency review |
| Implementation and integration | Codex / GPT-5.4 | Code changes, tests, refactors, integration, verification, and git close-out |

There is no agent hierarchy between Claude and Codex.
Alex is the only final decision maker.

## Core split

Do not split work only by broad module names.
Split it by layer:

- Spec layer: behavior rules, interface contracts, state transitions, exception policy, acceptance criteria
- Implementation layer: code, tests, refactors, adapters, integration, verification, and regressions

In short:
- Claude writes and reviews the behavior contract
- Codex implements and verifies it
- Both review each other from their own layer

## Repo mapping

The collaboration split maps to the current Enso repo like this:

| Area | Spec owner | Implementation owner | Main repo paths |
|------|------------|----------------------|-----------------|
| Brain / execution flow | `docs/spec/brain.md` | Codex | `src/main/core/execution-flow.ts`, `src/main/ipc.ts`, `src/shared/types.ts` |
| Context / retrieval / state | `docs/spec/context.md` | Codex | `src/main/services/knowledge-service.ts`, `src/main/services/store.ts`, `src/shared/types.ts` |
| Permission / safety | `docs/spec/permission.md` | Codex | `src/main/core/execution-flow.ts`, `src/main/services/host-exec-service.ts`, `src/main/services/config-service.ts`, renderer confirmation UI |
| Tool orchestration | `docs/spec/tools.md` | Codex | `src/main/services/tool-service.ts`, `src/main/services/workspace-service.ts`, `src/main/services/host-exec-service.ts` |
| UI shell and interaction | `docs/spec/ui.md` | Codex | `src/renderer/App.tsx`, `src/renderer/components/`, `src/renderer/lib/` |
| Audit | `docs/spec/audit.md` | Codex | `src/main/services/store.ts`, `src/main/core/execution-flow.ts`, renderer audit surfaces |

Cross-cutting files such as `src/shared/types.ts`, `src/main/ipc.ts`, and broad renderer wiring must have a single explicit owner for a given branch or task.
If ownership is unclear, Alex decides.

## Bidirectional review

### Claude reviews Codex output

Trigger:
- after Codex lands a branch-sized implementation change or reviewable milestone

Focus:
- behavior matches `docs/spec/*.md`
- names and abstractions still match the intended design
- state transitions and edge cases still align with the spec

Artifact:
- `docs/reviews/<area>-<date>.md`

### Codex reviews Claude output

Trigger:
- after Claude produces a new spec or materially changes an existing spec

Focus:
- feasibility in TypeScript / Electron / current repo structure
- dead states or impossible interfaces
- unnecessary abstraction or missing implementation detail
- performance or integration risks

Artifact:
- `docs/reviews/<area>-feasibility-<date>.md`

## Handoffs

When a branch, task, or review would benefit from an explicit handoff, create:
- `docs/handoffs/<branch-name>.md`

Use this structure:

```markdown
## Scope
## Completed
## Not Completed
## Risks
## Integration Notes
```

Create a handoff doc when it adds real value.
Do not create empty ceremony for every trivial change.

## File-boundary rule

Avoid concurrent edits to the same file set.
Prefer branch ownership by current repo slices:

- Execution core: `src/main/core/`, `src/shared/types.ts`, `src/main/ipc.ts`
- Context and persistence: `src/main/services/knowledge-service.ts`, `src/main/services/store.ts`, related config/state files
- Tools and safety: `src/main/services/tool-service.ts`, `src/main/services/workspace-service.ts`, `src/main/services/host-exec-service.ts`
- Provider wiring: `src/main/providers/`, `src/main/services/model-adapter.ts`, `src/main/services/secret-service.ts`
- Renderer shell: `src/renderer/App.tsx`, `src/renderer/components/`, `src/renderer/lib/`
- Docs and contracts: `docs/`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `tasks/`

If a change must cross slices, assign one owner and let the other side review instead of editing the same files in parallel.

## Working cadence

Use a narrow loop:

1. Claude proposes or updates the spec for one area.
2. Codex checks feasibility and raises implementation risks.
3. Alex decides if the direction is acceptable.
4. Codex implements the agreed scope and verifies it.
5. Claude reviews for spec consistency.
6. Alex accepts or redirects.

Do not open many parallel implementation tracks unless Alex explicitly wants that overhead.

## Client-specific reminder

- Claude should optimize for specs, review notes, and behavior contracts.
- Codex should optimize for code, tests, integration, and verification.
- Either side may point out gaps in the other's work, but should not silently take over the other's primary responsibility without a clear reason.
