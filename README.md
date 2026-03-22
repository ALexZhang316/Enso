# Enso Repository Baseline v0.3.4

The latest handoff pack has already been internalized into this repository.
Project-internal documents are the only active source of truth.
Do not rely on any external zip file during implementation or handoff.

## Onboarding order

1. `AGENTS.md`
2. `docs/baseline.md`
3. `docs/architecture.md`
4. `docs/codebase-contract.md`
5. `docs/environment-and-github-bootstrap.md`
6. `CLAUDE.md` only if the active coding client actually reads `CLAUDE.md`

## Document authority tiers

| Tier | Scope | Files |
|------|-------|-------|
| 1 | Live sources | `docs/baseline.md`, `docs/architecture.md` |
| 2 | Behavioral specs | `docs/spec/brain.md`, `permission.md`, `context.md`, `tools.md`, `ui.md`, `audit.md` |
| 3 | Code-layer contract | `docs/codebase-contract.md` |
| 4 | Reference | `docs/openclaw-reference-notes.md`, `docs/environment-and-github-bootstrap.md` |

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
- required GitHub CLI (`gh`) installation and authentication
- native rebuild prerequisites for `better-sqlite3`
- project install and verification
- GitHub initialization when this repository was copied without `.git`
- automatic GitHub CLI linking to the configured current repo during bootstrap

Built-in shortcut:
- `npm run bootstrap:git`

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
2. Install and authenticate GitHub CLI with `gh auth login`
3. Run `npm install`
4. Start dev mode with `npm run dev`
5. Build with `npm run build`
6. Launch the built app with `npm run start`

Automated checks:
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:ui`
- `npm run test:all`
- `npm run rebuild:native` if `better-sqlite3` has an ABI mismatch
