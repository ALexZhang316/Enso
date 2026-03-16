# Enso Repository Baseline v0.3.1

The latest handoff pack has already been internalized into this repository.
Project-internal documents are the only active source of truth.
Do not rely on any external zip file during implementation or handoff.

## Onboarding order

1. `AGENTS.md`
2. `docs/current-baseline.md`
3. `docs/execution-flow.md`
4. `docs/codebase-contract.md`
5. `docs/environment-and-github-bootstrap.md`
6. `CLAUDE.md` if your client reads it

## Why this baseline exists

The older direction over-weighted dialogue posture and under-weighted the execution core.
The revised direction keeps the parts worth preserving:
- single-user
- Windows desktop
- local-first control plane
- auditable behavior
- permission-gated actions
- configurable behavior

But changes the center of gravity to:
- high-value tool use
- complex problem solving
- bounded local execution
- visible planning, state, and verification
- heavy user customization

## Source-of-truth priority

When documents conflict, use this order:

1. `docs/current-baseline.md`
2. `docs/execution-flow.md`
3. `docs/windows-product-spec.md`
4. `docs/architecture.md`
5. `docs/module-spec-table.md`
6. `docs/ui-layout.md`
7. `docs/iteration-guidance.md`
8. `docs/revision-notes-2026-03-09.md`
9. `docs/openclaw-reference-notes.md`

## Project identity

- Single-user Windows desktop app
- Main chat window as control surface
- Local-first control plane
- Execution-first personal agent
- Problem solving over personality
- Tools, state, and verification over vibe
- Readable audit trail

## Mode system

Enso always has a **default mode**.
Users may optionally enable exactly one of three mutually exclusive modes:
- Deep Dialogue
- Decision
- Research

These modes are behavior biases applied to the same shared execution core.
If no optional mode is enabled, Enso runs in default mode.
No automatic mode routing.

## Locked implementation stack for the current stage

- Electron
- React + TypeScript
- Tailwind CSS + shadcn/ui
- LangChain.js
- better-sqlite3
- SQLite
- TOML
- provider abstraction with one model provider first

Node.js should stay on `20.x` for the current project stage.
Electron should stay on the current stable major unless there is a real blocker.
LangChain.js is glue/orchestration only and must not replace the product-defined execution flow.

## Environment and GitHub bootstrap

Operational setup is documented in:
- `docs/environment-and-github-bootstrap.md`

This includes:
- required Windows toolchain
- native rebuild prerequisites for `better-sqlite3`
- project install and verification
- GitHub initialization when this repository was copied without `.git`

Built-in shortcut:
- `npm run bootstrap:git`
- `npm run bootstrap:codex` for your Codex desktop shortcut, config, and Enter-key preferences

Default Git binding:
- `origin` is automatically set to `https://github.com/ALexZhang316/Enso.git`
- the bootstrap script also fetches remote metadata so local Git can see remote branches immediately
- use `powershell -File ./scripts/bootstrap-git.ps1 -OriginUrl <your-url>` if you need a different writable remote

## Text Encoding Note

- Repository text files should stay in UTF-8.
- On Windows PowerShell, run `. .\scripts\enable-utf8-terminal.ps1` before doc-heavy work or diff review.
- Prefer ASCII punctuation in docs when equivalent text works well enough, for example use `->` in place of a Unicode arrow.

## Run and verify

1. Install Node.js `20.x`
2. Run `npm install`
3. Start dev mode with `npm run dev`
4. Build with `npm run build`
5. Launch the built app with `npm run start`

Automated checks:
- `npm run test:mvp`
- `npm run test:mvp:ui`
- `npm run test:mvp:all`
- `npm run rebuild:native` if `better-sqlite3` has an ABI mismatch

## Deprecation note

Early pre-start planning files such as `docs/mvp-definition.md` and `docs/implementation-kickoff.md` are no longer active documents in this repository baseline.
