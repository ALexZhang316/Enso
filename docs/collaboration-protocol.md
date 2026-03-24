# Collaboration Protocol v2.0.0

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
- On code structure, schema, and current implementation notes, use `docs/codebase-contract.md`.

## Agent configuration files

`AGENTS.md` and `CLAUDE.md` are independent files with different purposes:

| File | Audience | Purpose | Tone |
|------|----------|---------|------|
| `AGENTS.md` | Codex (implementation agent) | Strict operational manual: workflow protocol, verification gates, file boundaries | Procedural, compliance-oriented |
| `CLAUDE.md` | Claude (spec/review agent) | Role definition: judgment framework, review standards, product boundary enforcement | Autonomous, judgment-oriented |

Rules:
- These two files must NOT be synchronized or cross-referenced. They serve different agents with different needs.
- Codex must not modify `CLAUDE.md`. Proposed changes go through Claude review and Alex approval.
- Claude must not modify `AGENTS.md`. Proposed changes go through Codex review and Alex approval.
- Neither agent may modify this file (`collaboration-protocol.md`) without Alex's explicit approval.

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

The collaboration split maps to the current Enso v2 repo like this:

| Area | Implementation owner | Main repo paths |
|------|----------------------|-----------------|
| 模型适配与流式对话 | Codex | `src/main/services/model-adapter.ts`, `src/main/services/prompts.ts` |
| IPC 与会话管理 | Codex | `src/main/ipc.ts`, `src/main/main.ts`, `src/main/preload.ts` |
| 数据持久化 | Codex | `src/main/services/store.ts`, `src/main/services/config-service.ts`, `src/main/services/secret-service.ts` |
| 共享类型与契约 | Codex | `src/shared/boards.ts`, `src/shared/types.ts`, `src/shared/bridge.ts`, `src/shared/providers.ts` |
| 渲染器 UI | Codex | `src/renderer/App.tsx`, `src/renderer/components/`, `src/renderer/lib/` |
| 文档与规范 | Claude | `docs/`, `CLAUDE.md` |

Cross-cutting files such as `src/shared/types.ts`, `src/main/ipc.ts`, and broad renderer wiring must have a single explicit owner for a given branch or task.
If ownership is unclear, Alex decides.

## Bidirectional review

### Claude reviews Codex output

Trigger:
- after Codex lands a branch-sized implementation change or reviewable milestone

Focus:
- behavior matches `docs/architecture.md` and `docs/baseline.md`
- names and abstractions still match the intended design
- data flow and edge cases still align with the design

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

- 主进程服务: `src/main/services/`, `src/main/ipc.ts`, `src/main/main.ts`
- 共享层: `src/shared/`
- 渲染器: `src/renderer/`
- 文档: `docs/`, `CLAUDE.md`, `AGENTS.md`

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

## Behavioral expectations

Claude:
- Thinks independently, questions flawed approaches, pushes back on wrong directions
- Writes and maintains behavior specs, not just reviews them
- May write code when it makes sense, but is not bound by the strict PREFLIGHT -> DONE workflow
- Reviews Codex output for spec consistency and design coherence

Codex:
- Follows the strict workflow protocol in `AGENTS.md` for every implementation task
- Stays within declared file scope, does not modify out-of-scope files
- Runs full verification before claiming completion
- Reviews Claude specs for feasibility and implementation risks

Either side may point out gaps in the other's work, but should not silently take over the other's primary responsibility without a clear reason.
