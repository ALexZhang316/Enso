# Codebase Contract v0.3.4

## 2026-03-21 Workflow Contract Update

- `AGENTS.md` now explicitly biases toward direct execution for clear, bounded tasks.
- Repo workflow now allows scoped progress when `preflight` / `verify` are already red because of known unrelated regressions, provided the baseline is stated and targeted verification is still run.
- Task-file creation and tri-doc updates are now proportional rather than automatic for every small change; they are required when the task materially changes behavior, limitations, or repo contract.
- `CLAUDE.md` mirrors the same lower-friction workflow so repo-local and Claude-specific instructions do not drift.
- The repo workflow now explicitly prefers bounded autopilot once objective, scope, and stop condition are clear.

## 2026-03-21 Task Brief Update

- `tasks/0002-permission-boundary-rework.md` now exists as the active repo-local implementation brief for the permission-system rewrite.
- The task captures:
  - front-loaded permission checks
  - distinct `model_call` and `local_egress` concerns
  - stricter host-exec boundary handling
  - real `allow / confirm / block` runtime semantics
- `tasks/INDEX.md` marks Task 0002 as `ready`.

## 2026-03-21 Provider Implementation Update

- `src/main/providers/` now includes:
  - `openai-compatible-provider.ts` for shared chat-completions style providers
  - `openai-provider.ts`
  - `deepseek-provider.ts`
  - `anthropic-provider.ts`
  - `gemini-provider.ts`
  - `provider-http-utils.ts`
- `provider-factory.ts` now returns concrete providers for all ids exposed in `src/shared/providers.ts`.
- `ModelAdapter` missing-key errors are provider-aware rather than Kimi-specific.
- Regression coverage now includes mocked response-shape tests for OpenAI, DeepSeek, Anthropic, and Gemini in addition to the provider-preset parity test.
- Current reality after this update:
  - provider/runtime parity is fixed
  - `npm run test:mvp:ui` passes
  - `npm run test:mvp` still fails only on the unresolved permission-boundary regressions added earlier

## 2026-03-21 Test Coverage Gap Update

- `tests/mvp.integration.test.cjs` now covers:
  - provider preset parity with `createTextGenerationProvider()`
  - `workspace_write` allow vs block semantics
  - `host_exec_readonly` allow vs block semantics
  - rejection of host-exec commands that target paths outside the Enso workspace
  - `external_network = block` preventing remote model calls
- Existing happy-path integration tests that require the remote model now explicitly set `external_network = "allow"` so they stop depending on the current runtime bug.
- `tests/mvp.ui.test.cjs` now seeds a network-allowed config for model-backed UI flows and adds an end-to-end `knowledge import -> retrieval -> evidence panel` regression.
- Current reality after the test expansion:
  - `npm run test:mvp:ui` passes.
- `npm run test:mvp` and therefore `npm run verify` fail on unresolved runtime defects in permission enforcement and host-exec workspace scoping.

## 2026-03-20 Per-Action Permission Model

- `EnsoConfig.permissions` changed from `{ readOnlyDefault, requireConfirmationForWrites, requireDoubleConfirmationForExternal }` (three booleans) to `Record<ActionType, PermissionLevel>`.
- `ActionType`: `workspace_write | host_exec_readonly | host_exec_destructive | external_network`.
- `PermissionLevel`: `allow | confirm | block`.
- New types exported from `src/shared/types.ts`: `ActionType`, `PermissionLevel`, `ACTION_TYPES`, `ACTION_TYPE_LABELS`, `PERMISSION_LEVEL_LABELS`.
- `ConfigService` normalization iterates `ACTION_TYPES` and validates each against `PERMISSION_LEVEL_VALUES`.
- `ExecutionFlow` gate check simplified: `config.permissions.workspace_write !== "allow"` replaces the old boolean OR.
- Settings panel renders a per-action dropdown table instead of three checkboxes.
- Workspace read is implicitly allowed (not in the permission map) since it has no side effects.

## 2026-03-20 Expression Preferences Redesign

- `EnsoConfig.expression` replaced: old fields (style, reducedQuestioning, defaultAssumption, riskLabeling) removed; new fields are `density` (concise/standard/detailed) and `structuredFirst` (boolean).
- New top-level `EnsoConfig.reportingGranularity` (plan-level / result-level) controls agent interruption frequency during execution.
- `ConfigService` normalization updated: validates `density` against `DENSITY_VALUES`, `structuredFirst` as boolean, `reportingGranularity` against `REPORTING_GRANULARITY_VALUES`.
- Settings panel shows density dropdown, structuredFirst checkbox, and granularity dropdown in separate sections.
- Right-rail context panel displays density and granularity instead of the old style field.
- `default.toml` updated with new schema; old expression fields are ignored if present in user configs.

## 2026-03-20 Mode Selector UI Update

- Mode selector no longer renders a "默认" button; default mode is the implicit baseline when no optional mode is active.
- `OPTIONAL_MODES` exported from `src/shared/modes.ts` filters out `default` for UI consumption.
- `handleModeSelect` in `App.tsx` now toggles: clicking an active optional mode reverts to `DEFAULT_MODE`.
- `ConfigService.normalizeConfig` forces `modeDefaults.defaultMode` to `"default"` regardless of TOML content.
- Settings panel removed the default-mode dropdown; retrieval checkboxes only show optional modes.
- Center pane header omits mode label in default mode; right rail shows "Enso" instead of "默认".
- Integration test updated: invalid `defaultMode` config now verifies silent override rather than expecting a thrown error.
- UI test updated: `expectActiveMode("default")` checks that all optional mode buttons have `aria-pressed="false"`.

## 2026-03-19 Host Exec Proposal Update

- Added `HostExecService` as a bounded execution layer for read-only PowerShell commands inside the Enso workspace.
- `PendingAction` is now a union type covering both `workspace_write` and `host_exec`.
- `ExecutionFlow.resolvePendingAction()` now dispatches confirmed actions by kind, including verified host exec runs.
- The renderer pending-action panel and confirmation button now adapt to both workspace writes and host exec proposals.
- Regression coverage now includes safe host exec confirmation/execution, destructive host exec blocking, and visible UI confirmation for host commands.

## 2026-03-19 Core Correctness Update

- `ConfigService` now validates runtime config values explicitly and raises `ConfigValidationError` with the `config.toml` path and failing field instead of silently returning defaults.
- Renderer bootstrap now surfaces init-time config failures as a blocking error card with a reload action.
- `ExecutionFlow` action detection now distinguishes informational prompts from real side-effect requests more narrowly; workspace-write proposals still gate explicit artifact-writing requests.
- `preflight` and `verify` now run `test:mvp:all`, so the formal acceptance path includes both integration and UI automation.
- Regression coverage now includes invalid config semantics, config-error recovery in the UI, and informational prompts that should stay on the dialogue path.

## 2026-03-19 Gate Regression Update

- Integration coverage now asserts unsupported-action requests stay blocked, persist the blocked trace phases, and write proposal-style audit entries without opening confirmation state.
- UI automation now verifies blocked-action rendering in the right rail, including verification status, trace text, audit summary, and the absence of a confirmation button.

## 2026-03-19 Retrieval Quality Update

- `EnsoStore` now maintains a local `knowledge_chunks_fts` SQLite virtual table for full-text retrieval over knowledge chunks.
- Retrieval prefers FTS ranking and falls back to the older `LIKE`-based keyword path when the FTS index is unavailable.
- Regression coverage now includes phrase-ranking behavior so exact phrase matches beat looser keyword-only hits.

## 2026-03-19 Repository Cleanup Update

- Removed the unreferenced root file `MVP_ACCEPTANCE_CHECKLIST_ZH.md`.
- Acceptance remains defined by `AGENTS.md` stop conditions together with the scripted verification flow (`verify`, `test:mvp`, `test:mvp:ui`).

## 2026-03-18 Runtime Wiring Update

- `ExecutionFlow` now honors persisted `modeDefaults.retrievalByMode` settings together with the per-turn `enableRetrievalForTurn` override.
- Assistant message metadata now persists `retrievedSnippets`, `retrievalSnippetCount`, and `retrievalSources` for the right-panel evidence view.
- Verification now fails when a retrieval/tool-required turn is missing evidence or tool output.
- Conversation bootstrap and new-conversation creation use `defaultMode` from config (now always forced to `"default"`).
- Regression coverage now includes retrieval wiring, verification failure semantics, snippet persistence, and configured default-mode behavior.

## 2026-03-18 Proposal-To-Execution Update

- Added `WorkspaceService` as the bounded workspace layer under `userData/workspace`.
- `StateSnapshot` now persists `pendingAction` so gated write proposals survive the confirmation boundary.
- `ExecutionFlow.resolvePendingAction()` now executes confirmed workspace writes, verifies file existence, and writes a follow-up audit entry.
- The renderer now shows the active workspace root and the current pending action summary.
- External side effects, destructive actions, and broader host exec remain blocked; bounded workspace writes and read-only workspace host exec now participate in the confirmation-to-execution chain.

## 本文件的作用

产品文档描述"Enso 应该是什么"。
本文件描述"代码现在实际长什么样"。

本仓库内的文档已经内化为唯一权威来源。
接手时不要依赖任何外部 handoff zip。

每次一个 AI 模型完成一轮开发后，必须更新本文件。
下一个接手的模型在动手写代码之前，必须先按仓库内 onboarding 顺序读共享文档，再回到本文件核对代码现状。

如果本文件与实际代码不一致，以实际代码为准，但接手模型应先修正本文件再继续开发。

---

## 文档优先级（当前唯一权威来源）

发生冲突时，按以下顺序取舍：

1. `docs/current-baseline.md`
2. `docs/execution-flow.md`
3. `docs/windows-product-spec.md`
4. `docs/architecture.md`
5. `docs/module-spec-table.md`
6. `docs/ui-layout.md`
7. `docs/iteration-guidance.md`
8. `docs/revision-notes-2026-03-09.md`
9. `docs/openclaw-reference-notes.md`

---

## 运行与 Git 初始化

环境补齐、原生依赖重建、项目验收，以及缺少 `.git` 时的 GitHub 初始化步骤，统一见：

- `docs/environment-and-github-bootstrap.md`

---

## 文本编码约定

- 仓库文本文件统一使用 UTF-8。
- 在 Windows PowerShell 中进行文档编辑、diff 审阅或复制终端输出前，先执行 `. .\scripts\enable-utf8-terminal.ps1`。
- 文档里优先使用 ASCII 标点的等价写法，例如用 `->` 代替 Unicode 箭头。

---

## 目录结构（每轮更新）

在下方填写当前实际的目录树。不要写计划中的结构，只写已经存在的文件。

```
tasks/
  TEMPLATE.md                    # Task file template
  INDEX.md                       # Task backlog index
  0001-dev-workflow-system.md    # First completed task
scripts/
  bootstrap-git.ps1              # Git initialization
  enable-utf8-terminal.ps1       # UTF-8 terminal setup
  check-docs-updated.cjs         # Post-flight doc update checker
src/
  main/
    core/
      execution-flow.ts        # 主执行链路 (classify -> plan -> retrieval -> tool -> model -> verify -> gate -> persist)
    providers/
      kimi-provider.ts         # Kimi (Moonshot) API 调用实现
      provider-factory.ts      # provider 工厂
      types.ts                 # provider 接口定义
    services/
      config-service.ts        # TOML 配置读写
      host-exec-service.ts     # 工作区内只读主机命令 proposal/执行/验证
      knowledge-service.ts     # 知识库导入/分块/检索
      model-adapter.ts         # 模型调用适配层
      secret-service.ts        # 密钥加密存储 (safeStorage)
      store.ts                 # SQLite 持久化 (会话/消息/状态/审计/知识)
      tool-service.ts          # 工具决策与执行 (compute/search/read/exec metadata)
    ipc.ts                     # Electron IPC handler 注册
    main.ts                    # Electron 主进程入口
    preload.ts                 # preload bridge
  renderer/
    components/ui/             # shadcn/ui 组件 (badge, button, card, input, scroll-area, separator, textarea)
    App.tsx                    # 主 UI (三栏布局)
    browser-mock.ts            # 浏览器环境 mock (测试用)
    lib/utils.ts               # 工具函数
    main.tsx                   # React 入口
    vite-env.d.ts
  shared/
    bridge.ts                  # preload <-> renderer 类型定义
    modes.ts                   # 模式定义 (default/deep-dialogue/decision/research)
    providers.ts               # provider 预设定义
    types.ts                   # 核心类型 (含 ExecutionPlan/TraceEntry/VerificationResult)
```

---

## 模块边界登记表

| 模块名 | 主文件路径 | 对外暴露的函数/类 | 依赖哪些其他模块 | 当前状态 |
|--------|-----------|------------------|----------------|---------|
| ExecutionFlow | src/main/core/execution-flow.ts | ExecutionFlow.run() | ConfigService, KnowledgeService, ToolService, ModelAdapter, EnsoStore, WorkspaceService, HostExecService | 可运行，已集成完整链路 |
| EnsoStore | src/main/services/store.ts | EnsoStore (class) | better-sqlite3 | 可运行，含 plan/trace/verification 持久化 |
| ConfigService | src/main/services/config-service.ts | ConfigService (class) | @iarna/toml | 可运行 |
| HostExecService | src/main/services/host-exec-service.ts | HostExecService (class) | child_process, workspace boundary | 可运行，支持工作区内只读命令 |
| KnowledgeService | src/main/services/knowledge-service.ts | KnowledgeService (class) | EnsoStore | 可运行，已接入执行流 |
| ToolService | src/main/services/tool-service.ts | ToolService.decideAndRun() | -- | 可运行，已接入执行流 |
| ModelAdapter | src/main/services/model-adapter.ts | ModelAdapter.generateReply() | ProviderFactory | 可运行 |
| SecretService | src/main/services/secret-service.ts | SecretService (class) | Electron safeStorage | 可运行 |
| KimiProvider | src/main/providers/kimi-provider.ts | KimiProvider (class) | axios | 可运行，唯一可用 provider |
| IPC | src/main/ipc.ts | registerIpcHandlers() | 所有 service + ExecutionFlow | 可运行 |
| App (Renderer) | src/renderer/App.tsx | App component | shared types, shadcn/ui | 可运行，含 plan/trace/verification 面板 |

---

## 命名约定（一旦确定不要改）

- 文件命名风格：kebab-case (如 execution-flow.ts, tool-service.ts)
- 导出风格：named exports (class 或 function)
- 组件命名：PascalCase React 组件 (如 App, Badge, Button)
- 数据库表名风格：snake_case (如 state_snapshots, knowledge_chunks)
- 配置键名风格：TOML 中 kebab-case (如 read-only-default)
- TypeScript 类型/接口：PascalCase (如 ExecutionPlan, TraceEntry)

---

## 数据流约定

1. 模块之间通过**直接函数调用**通信。ExecutionFlow 持有所有 service 的引用，在构造时注入。
2. 前后端通过 **Electron IPC** 通信。Channel 名称: enso:init, enso:request:submit, enso:conversation:*, enso:mode:set, enso:config:*, enso:file:import, enso:knowledge:retrieve, enso:audit:list, enso:confirmation:resolve, enso:provider:key:*
3. 前端状态管理：**React useState** (无外部状态库)。所有状态存在 App.tsx 顶层组件中。
4. 数据库访问集中在 **EnsoStore** 一个模块中，其他模块通过 EnsoStore 的方法读写数据。

---

## 数据库 Schema（每轮更新）

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
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE state_snapshots (
  conversation_id TEXT PRIMARY KEY,
  retrieval_used INTEGER NOT NULL DEFAULT 0,
  tools_called_json TEXT NOT NULL DEFAULT '[]',
  latest_tool_result TEXT NOT NULL DEFAULT '',
  pending_confirmation INTEGER NOT NULL DEFAULT 0,
  pending_action_json TEXT NOT NULL DEFAULT 'null', -- 2026-03-18 added
  task_status TEXT NOT NULL DEFAULT 'idle',
  updated_at TEXT NOT NULL,
  plan_json TEXT NOT NULL DEFAULT 'null',       -- 2026-03-18 新增
  trace_json TEXT NOT NULL DEFAULT '[]',        -- 2026-03-18 新增
  verification_json TEXT NOT NULL DEFAULT 'null' -- 2026-03-18 新增
);

CREATE TABLE audits (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  retrieval_used INTEGER NOT NULL DEFAULT 0,
  tools_used_json TEXT NOT NULL DEFAULT '[]',
  result_type TEXT NOT NULL DEFAULT 'answer',
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

---

## 已做的关键实现决策

记录那些"两种做法都行，但我们选了其中一种"的决定。后续模型不要推翻这些决策，除非有明确指令。

| 决策内容 | 选择了什么 | 为什么 | 哪一轮做的决定 |
|---------|-----------|-------|-------------|
| 模式系统默认态 | 保留独立 `default` 模式，不再用 `deep-dialogue` 兼任默认值 | 对齐产品硬约束，避免”默认模式”和”深度对话模式”语义混淆 | Codex 本轮 |
| OpenClaw 借鉴范围 | 借鉴执行骨架与权限边界，不借鉴产品外形 | 保持 Enso 是本地单用户执行工作台 | Codex 本轮 |
| 高权限动作当前策略 | workspace_write 与只读 workspace host exec 走 proposal -> confirmation -> execution；外部/破坏性动作继续 blocked | 先把可验证、可见、低风险的执行链做实，再扩到更高风险动作 | Codex 2026-03-19 |
| 主机命令执行策略 | 仅允许工作区内只读 PowerShell 命令走 proposal -> confirmation -> execution | 在不打开破坏性或外部副作用的前提下，先把 `exec` 安全链做实 | Codex 2026-03-19 |
| 检索触发策略 | 关键词匹配 + 模式偏置 (decision/research 自动检索) | 简单可控，避免过度检索 | Claude 2026-03-18 |
| 工具触发策略 | 关键词匹配 (compute/read 类关键词) | 与现有 ToolService 能力对齐 | Claude 2026-03-18 |
| plan/trace/verification 持久化方式 | JSON 字段存入 state_snapshots 表 (plan_json/trace_json/verification_json) | 避免新增表，保持 schema 简洁 | Claude 2026-03-18 |
| 验证逻辑 | 分类别检查：retrieval 有片段、tool 有结果、model 有回复 | 简单明确，可渐进增强 | Claude 2026-03-18 |

---

## 当前已知问题和 TODO

| 问题描述 | 严重程度 | 属于哪个模块 | 哪一轮发现的 | 状态 |
|---------|---------|------------|------------|------|
| `ExecutionFlow` 仍是 MVP 骨架，尚未把 retrieval / tool / verifier 真正串入主链 | 高 | ExecutionFlow | Codex 初始轮 | 已解决 2026-03-18 |
| retrieval / tool service 尚未真正接入主执行流 | 高 | ExecutionFlow / Tool / Knowledge | Codex 初始轮 | 已解决 2026-03-18 |
| 右栏仍缺少文档要求的显式 current plan / execution trace / verification 结果视图 | 中 | Renderer UI | Codex 初始轮 | 已解决 2026-03-18 |
| 外部动作、破坏性命令和更广泛的 host exec 仍没有完整 proposal-to-execution 安全链 | 中 | IPC / Permission Gate | Codex 初始轮 | 部分解决 2026-03-19 |
| 只有 Kimi 一个 provider 有实际实现 | 低 | Providers | Codex 初始轮 | 未解决 - 不阻塞核心链路 |
| 检索质量依赖关键词匹配，无向量语义搜索 | 低 | KnowledgeService | Claude 2026-03-18 | 未解决 - 后续增强 |

---

## 交接检查清单

每次从一个模型切换到另一个模型时，交出方必须确认以下事项：

- [ ] 本文件已更新至最新状态
- [ ] 目录结构部分与实际文件一致
- [ ] 模块边界登记表已补充新增模块
- [ ] 数据库 Schema 部分与实际表结构一致
- [ ] 已知问题和 TODO 部分已更新
- [ ] 应用可以正常启动（npm start 或等效命令无报错）
- [ ] 本轮新增的关键实现决策已记录
- [ ] 如有 tasks/ 任务文件，状态已更新为 done 且所有清单已勾选
- [ ] `npm run postflight` 通过且无未处理的警告

---

## 接手方首要动作

接手的模型在写任何代码之前，必须先做以下事情：

1. 读 `AGENTS.md`
2. 读 `docs/current-baseline.md`
3. 读 `docs/execution-flow.md`
4. 回到本文件，确认当前代码约定和实际代码是否一致
5. 读 `docs/environment-and-github-bootstrap.md`
6. 如当前客户端会读取 `CLAUDE.md`，再读 `CLAUDE.md`
7. 运行项目，确认能启动
8. 用一句话向用户总结自己对当前代码状态的理解，等用户确认后再动手
