# Codebase Contract v0.3.4

## Purpose

This file records the current repo-local contract for the codebase as it exists today.
It is not a running changelog.
Prefer current code over stale prose, and update this file when directory structure, module ownership, schema, or known active issues materially change.

## Document authority

See `AGENTS.md` for the full authority model.

Summary:
- Product and architecture: `docs/baseline.md`, `docs/architecture.md`
- Behavioral source of truth: `docs/spec/*.md`
- Collaboration protocol: `docs/collaboration-protocol.md`
- Code-layer contract: this file
- Reference and operational: `docs/openclaw-reference-notes.md`, `docs/environment-and-github-bootstrap.md`

## Workflow docs

- `AGENTS.md` is the repo-local supplement to the global AGENTS rules.
- `CLAUDE.md` mirrors the same repo-local contract for clients that read it.
- `docs/collaboration-protocol.md` records Alex / Claude / Codex collaboration rules, review artifacts, and handoff expectations.
- `README.md` is a human-readable repository overview and should be kept in sync, but it is not a source-of-truth document.

## Current workflow state

- The repo keeps the simple loop `PREFLIGHT -> PLAN -> WORK -> VERIFY -> POSTFLIGHT -> DONE`.
- `npm run preflight`, `npm run verify`, and `npm run postflight` are green after the permission-boundary rework.
- `scripts/bootstrap-git.ps1` is the supported Git/GitHub bootstrap path when `.git` is missing; it now requires GitHub CLI authentication and links the local `gh` default repository to `origin`.
- For doc-only work, a recorded red baseline plus `node scripts/check-docs-updated.cjs` is an acceptable verification fallback when those unrelated regressions prevent full postflight from going green.

## Current directory contract

```text
config/
  default.toml
docs/
  collaboration-protocol.md
  baseline.md
  architecture.md
  codebase-contract.md
  environment-and-github-bootstrap.md
  openclaw-reference-notes.md
  spec/
    brain.md
    permission.md
    context.md
    tools.md
    ui.md
    audit.md
  reviews/
  handoffs/
scripts/
  bootstrap-git.ps1
  check-docs-updated.cjs
  enable-utf8-terminal.ps1
src/
  main/
    core/
      execution-flow.ts
    providers/
      anthropic-provider.ts
      deepseek-provider.ts
      gemini-provider.ts
      kimi-provider.ts
      openai-compatible-provider.ts
      openai-provider.ts
      provider-factory.ts
      provider-http-utils.ts
      types.ts
    services/
      config-service.ts
      host-exec-service.ts
      knowledge-service.ts
      model-adapter.ts
      secret-service.ts
      store.ts
      tool-service.ts
      workspace-service.ts
    ipc.ts
    main.ts
    preload.ts
  renderer/
    App.tsx
    browser-mock.ts
    index.css
    main.tsx
    components/
      LeftPanel.tsx
      CenterPanel.tsx
      RightPanel.tsx
      ui/
    lib/
      labels.ts
      utils.ts
  shared/
    bridge.ts
    modes.ts
    providers.ts
    types.ts
tasks/
  0002-permission-boundary-rework.md
  INDEX.md
  TEMPLATE.md
```

## Runtime module contract

### Core runtime

- `src/main/core/execution-flow.ts`
  Owns the planner -> executor -> verifier turn flow, pending confirmation resolution, trace writing, and persistence handoff.

### Main-process services

- `config-service.ts`
  Loads, normalizes, validates, and saves TOML config.
- `host-exec-service.ts`
  Validates and executes bounded read-only host commands under the current workspace rules.
- `knowledge-service.ts`
  Imports local documents, chunks them, and retrieves evidence through the store.
- `model-adapter.ts`
  Wraps provider-backed text generation.
- `secret-service.ts`
  Stores provider keys using Electron safe storage.
- `store.ts`
  Owns SQLite persistence for conversations, messages, state, audits, and knowledge.
- `tool-service.ts`
  Decides and runs bounded tool calls.
- `workspace-service.ts`
  Manages the Enso-owned local workspace root and bounded writes.

### Provider layer

Current provider implementations:
- Kimi
- OpenAI
- DeepSeek
- Anthropic
- Gemini

Provider wiring lives under `src/main/providers/`.

### Shared contract layer

- `src/shared/modes.ts`
  Defines `default`, `deep-dialogue`, `decision`, and `research`.
- `src/shared/providers.ts`
  Defines provider presets exposed in the app.
- `src/shared/types.ts`
  Defines core runtime, config, trace, verification, and permission types.

### Renderer contract

- `src/renderer/App.tsx`
  Owns the fixed three-panel shell and the renderer-visible state for conversations, mode toggles, config, plan, trace, verification, pending confirmations, evidence, and audit signals.
- `src/renderer/components/`
  Holds LeftPanel, CenterPanel, RightPanel and local UI primitives.
- `src/renderer/lib/labels.ts`
  Pure mapping functions for display labels.

## Current config contract

### Modes

- `default` is the implicit baseline mode.
- Optional modes are `deep-dialogue`, `decision`, and `research`.
- Optional modes are manual and mutually exclusive.

### Providers

Current preset ids:
- `kimi`
- `openai`
- `deepseek`
- `anthropic`
- `gemini`

### Expression config

- `density`: `concise | standard | detailed`
- `structuredFirst`: boolean
- top-level `reportingGranularity`: `plan-level | result-level`

### Permission config

Per-action `allow | confirm | block` map for:
- `workspace_write`
- `host_exec_readonly`
- `host_exec_destructive`
- `external_network`

Workspace reads are implicitly allowed.

## Persistence contract

SQLite tables currently owned by `src/main/services/store.ts`:

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  mode TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE state_snapshots (
  conversation_id TEXT PRIMARY KEY,
  retrieval_used INTEGER NOT NULL DEFAULT 0,
  tools_called_json TEXT NOT NULL DEFAULT '[]',
  latest_tool_result TEXT NOT NULL DEFAULT '',
  pending_confirmation INTEGER NOT NULL DEFAULT 0,
  pending_action_json TEXT NOT NULL DEFAULT 'null',
  task_status TEXT NOT NULL DEFAULT 'idle',
  updated_at TEXT NOT NULL,
  plan_json TEXT NOT NULL DEFAULT 'null',
  trace_json TEXT NOT NULL DEFAULT '[]',
  verification_json TEXT NOT NULL DEFAULT 'null'
);

CREATE TABLE audits (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  retrieval_used INTEGER NOT NULL DEFAULT 0,
  tools_used_json TEXT NOT NULL DEFAULT '[]',
  result_type TEXT NOT NULL,
  risk_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE knowledge_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE knowledge_chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE VIRTUAL TABLE knowledge_chunks_fts USING fts5(
  chunk_id UNINDEXED,
  source_id UNINDEXED,
  content,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
```

## Active task file

Current tracked repo-local task file:
- `tasks/0002-permission-boundary-rework.md` (done; retained as the latest completed implementation brief)

## Known active issues

- Runtime permission enforcement now covers workspace_write, host_exec_readonly, and external_network with real allow/confirm/block semantics. Advanced permission dimensions (model_call/local_egress split, intent-source classification) are deferred.
- `npm run verify` and `npm run postflight` are green.
- Some runtime labels and descriptions in `src/shared/modes.ts` and `src/shared/types.ts` still contain garbled text and should be normalized in a future cleanup round.
- Reference-only docs (`execution-flow.md`, `module-spec-table.md`, `ui-layout.md`, `windows-product-spec.md`) have been removed; their behavioral rules are now in `docs/spec/`.

## Maintenance rule

Update this file when any of the following change materially:
- document authority tiers
- directory structure
- module ownership
- provider/config contract
- SQLite schema
- active task backlog with repo-wide relevance
- known active regressions or contract drift
