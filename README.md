# Enso v0.1 MVP Skeleton

Enso is a local-first Windows desktop personal-agent MVP with a fixed three-panel main window and manual mode switching.

## Implemented Scope (This Round)

- Electron desktop shell
- React + TypeScript + Tailwind + shadcn-style UI
- Fixed three-panel layout (left 20% / center 55% / right 25%)
- Manual mode switching: Deep Dialogue / Decision / Research
- Local config read/write foundations (TOML)
- Basic settings panel wired to local TOML config
- Risk-labeling preference in local config (`always` / `balanced-only` / `off`)
- Local session/state/audit persistence foundations (SQLite via better-sqlite3)
- File import entry for local knowledge ingestion
- Minimal retrieval wiring from imported knowledge chunks
- Single-request execution chain skeleton aligned to `docs/execution-flow.md`
- Minimal tool abstraction: read / search / compute
- Basic audit records view (current conversation or global)
- Pending-confirmation acknowledgment action in UI (read-only gate remains in effect)
- Retrieved evidence snippets surfaced in right context panel
- Message rendering supports markdown headings, blockquotes, and code blocks

## Locked Stack

- Electron
- React + TypeScript
- Tailwind CSS + shadcn-style component primitives
- LangChain.js (integration helper only)
- better-sqlite3 + SQLite
- TOML config

## Project Structure

- `src/main`: Electron main process, preload, IPC, execution/services
- `src/renderer`: React UI app
- `src/shared`: shared types, mode definitions, bridge contracts
- `config/default.toml`: default user-editable config template
- `docs/`: source-of-truth product and flow specs

## Run

1. Install Node.js 20.x LTS.
2. Install dependencies:
   - `npm install`
3. Start dev mode:
   - `npm run dev`
4. Build:
   - `npm run build`
5. Launch built app:
   - `npm run start`

## Automated Tests

- Run MVP integration checks:
  - `npm run test:mvp`
- Run MVP UI acceptance checks:
  - `npm run test:mvp:ui`
- Run all automated MVP checks:
  - `npm run test:mvp:all`

The script rebuilds the app and runs automated checks for local config, SQLite persistence,
knowledge ingestion/retrieval, the single-request execution chain, and the read-only gate.
The UI acceptance script launches Electron with isolated `userData`, drives the three-pane
window through Playwright, and verifies mode switching, local file import, chat submission,
gate confirmation, settings save, and audit display.

If native module ABI mismatch occurs (e.g., `better-sqlite3` load error), run:
- `npm run rebuild:native`

## Model Provider

- Default provider config is in local TOML (`config.toml` copied to user data directory on first launch).
- Set `OPENAI_API_KEY` in your environment for live model calls.
- Without an API key, Enso returns a local stub draft response.

## Data Location

Local runtime files are stored in Electron `userData`:

- `enso.sqlite` (sessions, state, audit, knowledge metadata/chunks)
- `config.toml` (user-editable config)

## MVP Boundaries Preserved

- No auto-routing / no auto mode selection
- No nonlinear conversation canvas/branching
- No automatic long-term memory
- No vibecoding mode
- No multi-agent orchestration
- Read-only default gate for action-adjacent requests
