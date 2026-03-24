# Enso Repository Baseline v2.0.0

The latest handoff pack has already been internalized into this repository.
Project-internal documents are the only active source of truth.
Do not rely on any external zip file during implementation or handoff.

## Onboarding order

1. `docs/collaboration-protocol.md` - role split and review rules
2. `docs/baseline.md` - product identity and direction
3. `docs/architecture.md` - component boundary map
4. `docs/codebase-contract.md` - code-layer contract
5. `docs/environment-and-github-bootstrap.md` - environment setup

Agent-specific configuration (independent files, not synchronized):
- `AGENTS.md` - operational manual for Codex (implementation agent)
- `CLAUDE.md` - role definition for Claude (spec/review agent)

## Document authority by scope

| Scope | Files |
|------|-------|
| Product and architecture | `docs/baseline.md`, `docs/architecture.md` |
| Behavioral source of truth | `docs/baseline.md`, `docs/architecture.md` |
| Collaboration and review | `docs/collaboration-protocol.md`, `docs/reviews/`, `docs/handoffs/` |
| Code-layer contract | `docs/codebase-contract.md` |
| Reference and operational | `docs/environment-and-github-bootstrap.md` |

## Project identity

- Single-user Windows desktop app
- 三板块对话工具：深度对话、投资决策、科研辅助
- 能力优先，不是防御优先
- 本地数据所有权
- 多提供商（OpenAI、Anthropic、Google、Kimi）

## 板块系统

Enso 有三个严格隔离的板块，用户手动切换：
- **深度对话 (dialogue)** — 哲学、艺术、宗教、美学
- **投资决策 (decision)** — 美股长期资产配置
- **科研辅助 (research)** — 临床医学文献与论文

没有默认模式，没有自动路由。

## Locked implementation stack for the current stage

- Electron
- React + TypeScript
- Tailwind CSS + shadcn/ui
- Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`)
- better-sqlite3 + SQLite
- TOML config

Node.js should stay on `20.x` for the current project stage.
Electron should stay on the current stable major unless there is a real blocker.

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
