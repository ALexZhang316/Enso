# Personal Agent Handoff Pack

This pack converts the planning docs into repo-friendly Markdown for coding agents.

## Included files

- `AGENTS.md` — primary implementation instructions for Codex / repo-aware agents
- `CLAUDE.md` — project instructions for Claude Code
- `docs/architecture.md`
- `docs/windows-product-spec.md`
- `docs/module-spec-table.md`
- `docs/mvp-definition.md`
- `docs/ui-layout.md`
- `docs/execution-flow.md`
- `docs/implementation-kickoff.md`

## Source-of-truth priority

When documents conflict, use this order:

1. `docs/mvp-definition.md`
2. `docs/execution-flow.md`
3. `docs/ui-layout.md`
4. `docs/windows-product-spec.md`
5. `docs/architecture.md`
6. `docs/module-spec-table.md`

## Project identity

- Single-user Windows desktop app
- Main chat window form factor
- Local-first architecture
- Default mode: Deep Dialogue
- Secondary modes: Decision, Research
- No automatic routing
- No vibecoding mode


## Locked implementation stack for v0.1

The current handoff pack assumes the following fixed stack unless there is a hard blocker:

- Electron
- React + TypeScript
- Tailwind CSS + shadcn/ui
- LangChain.js
- better-sqlite3
- SQLite
- TOML
- OpenAI-compatible provider abstraction

Node.js and Electron versions should be locked to stable releases for v0.1.
LangChain.js is used as glue/orchestration only and must not override the execution-flow spec.
