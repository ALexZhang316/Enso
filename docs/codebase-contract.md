# Codebase Contract v0.3.1

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
      knowledge-service.ts     # 知识库导入/分块/检索
      model-adapter.ts         # 模型调用适配层
      secret-service.ts        # 密钥加密存储 (safeStorage)
      store.ts                 # SQLite 持久化 (会话/消息/状态/审计/知识)
      tool-service.ts          # 工具决策与执行 (compute/search/read)
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
| ExecutionFlow | src/main/core/execution-flow.ts | ExecutionFlow.run() | ConfigService, KnowledgeService, ToolService, ModelAdapter, EnsoStore | 可运行，已集成完整链路 |
| EnsoStore | src/main/services/store.ts | EnsoStore (class) | better-sqlite3 | 可运行，含 plan/trace/verification 持久化 |
| ConfigService | src/main/services/config-service.ts | ConfigService (class) | @iarna/toml | 可运行 |
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
  created_at TEXT NOT NULL
);

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## 已做的关键实现决策

记录那些"两种做法都行，但我们选了其中一种"的决定。后续模型不要推翻这些决策，除非有明确指令。

| 决策内容 | 选择了什么 | 为什么 | 哪一轮做的决定 |
|---------|-----------|-------|-------------|
| 模式系统默认态 | 保留独立 `default` 模式，不再用 `deep-dialogue` 兼任默认值 | 对齐产品硬约束，避免”默认模式”和”深度对话模式”语义混淆 | Codex 本轮 |
| OpenClaw 借鉴范围 | 借鉴执行骨架与权限边界，不借鉴产品外形 | 保持 Enso 是本地单用户执行工作台 | Codex 本轮 |
| 高权限动作当前策略 | 先输出 proposal / blocked result，不执行真实 host exec | 先补齐可见主链与验证，再扩执行能力 | Codex 本轮 |
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
| 高权限动作仍只有门控拦截，没有完整 proposal-to-execution 安全链 | 中 | IPC / Permission Gate | Codex 初始轮 | 未解决 - 按计划延后 |
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
