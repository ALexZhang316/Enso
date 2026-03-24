# Codebase Contract v0.4.0

## Purpose

This file records the current repo-local contract for the codebase as it exists today.
Prefer current code over stale prose, and update this file when directory structure, module ownership, schema, or known active issues materially change.

## Current directory contract

```text
config/
  default.toml
docs/
  baseline.md
  architecture.md
  codebase-contract.md
  collaboration-protocol.md
  environment-and-github-bootstrap.md
scripts/
  bootstrap-git.ps1
  check-docs-updated.cjs
  enable-utf8-terminal.ps1
src/
  main/
    services/
      config-service.ts
      model-adapter.ts
      prompts.ts
      secret-service.ts
      store.ts
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
      ui/
    lib/
      utils.ts
    assets/
      alex-avatar.jpg
      enso-avatar.png
  shared/
    boards.ts
    bridge.ts
    providers.ts
    types.ts
```

## Runtime module contract

### Main-process services

- `model-adapter.ts`
  Wraps Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) for streaming text generation across four providers (OpenAI, Anthropic, Google, Kimi). Injects board-specific system prompts.
- `prompts.ts`
  Board-specific system prompt definitions for dialogue, decision, and research.
- `config-service.ts`
  Loads, normalizes, and saves TOML config. Supports per-provider model/baseUrl configuration.
- `secret-service.ts`
  Stores provider API keys using Electron safe storage with AES-256-GCM fallback.
- `store.ts`
  Owns SQLite persistence for conversations, messages, and app state. No audit, knowledge, or state snapshot tables.

### Shared contract layer

- `src/shared/boards.ts`
  Defines three boards: `dialogue`, `decision`, `research`. Each board has temperature, maxTokens, historyWindow, and hasTools settings.
- `src/shared/providers.ts`
  Defines four provider presets: `openai`, `anthropic`, `google`, `kimi`.
- `src/shared/types.ts`
  Core types: Conversation, ChatMessage, EnsoConfig, ProviderConfig, StreamChunk/End/Error, InitializationPayload.
- `src/shared/bridge.ts`
  IPC bridge contract between renderer and main process. Includes stream event listeners.

### Renderer contract

- `src/renderer/App.tsx`
  Two-column layout. Manages board switching, conversation CRUD, streaming state, model selection.
- `src/renderer/components/LeftPanel.tsx`
  Board tabs + conversation list + settings entry.
- `src/renderer/components/CenterPanel.tsx`
  Chat messages with streaming display, markdown rendering, model/provider selector, settings page.

## Current config contract

### Boards

Three boards, no default mode:
- `dialogue` — deep philosophical/aesthetic conversations
- `decision` — investment analysis and asset allocation
- `research` — clinical medicine literature and paper writing

### Providers

Current preset ids:
- `openai`
- `anthropic`
- `google`
- `kimi`

Each provider has independent model, baseUrl, and API key configuration.

### Removed from v1

- Expression config (density, structuredFirst, reportingGranularity)
- Permission config (action types, permission levels)
- Mode defaults (defaultMode)
- Knowledge/RAG system
- Audit system
- State snapshots
- Execution flow pipeline

## Persistence contract

SQLite tables currently owned by `src/main/services/store.ts`:

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  title TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_name TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
```

## Dependencies

### Runtime
- `ai` — Vercel AI SDK core
- `@ai-sdk/openai` — OpenAI + Kimi (compatible) provider
- `@ai-sdk/anthropic` — Anthropic provider
- `@ai-sdk/google` — Google Gemini provider
- `better-sqlite3` — SQLite database
- `@iarna/toml` — TOML config parsing
- `react`, `react-dom` — UI framework
- `react-markdown`, `remark-gfm` — Markdown rendering
- Tailwind CSS + shadcn/ui component primitives

### Removed from v1
- `@langchain/core`, `@langchain/openai`, `langchain`
- `@node-rs/jieba` (Chinese word segmentation)

## Known active issues

- Tool calling not yet implemented (web search, academic search, file operations). Current v2 is dialogue-only.
- Portfolio table (investment tracking) not yet created.
- Old SQLite databases will auto-migrate `mode` column to `board` on first load.

## Maintenance rule

Update this file when any of the following change materially:
- directory structure
- module ownership
- provider/config contract
- SQLite schema
- dependency changes
