# Architecture v2.1.0

## 一句话架构

用户在三个隔离板块中选择一个 → 选择模型/提供商 → 发送消息 → 流式生成回复 → 本地持久化。

没有规划器、执行引擎、验证器、审计、权限门控。能力优先，不是防御优先。

## 组件边界图

```text
+------------------+     +------------------+     +------------------+
|   Renderer       |     |   Main Process   |     |   External       |
|   (React)        |     |   (Electron)     |     |   Services       |
+------------------+     +------------------+     +------------------+
| App.tsx          |     | ipc.ts           |     | OpenAI API       |
|  - 板块切换       | IPC |  - 会话 CRUD      |     | Anthropic API    |
|  - 会话管理       |<--->|  - 流式发送/取消   |     | Google AI API    |
|  - 流式显示       |     |  - 配置读写       |     | Moonshot API     |
|  - 模型选择       |     +--------+---------+     +------------------+
|  - 设置页         |              |
+------------------+              v
                       +--------+---------+
                       | model-adapter.ts |
                       |  - 构建 provider  |
                       |  - 注入系统 prompt |
                       |  - streamText     |
                       +--------+---------+
                                |
                                v
                       +--------+---------+
                       | store.ts         |
                       |  - conversations |
                       |  - messages      |
                       |  - app_state     |
                       +------------------+
```

## 板块系统

三个板块，严格隔离，用户手动切换。没有默认模式，没有自动路由。

| 板块 | 温度 | 最大输出 | 历史窗口 | 工具 |
|------|------|---------|---------|------|
| 深度对话 (dialogue) | 0.9 | 8192 | 100 轮 | 无 |
| 投资决策 (decision) | 0.5 | 4096 | 48 轮 | 待实现 |
| 科研辅助 (research) | 0.4 | 8192 | 48 轮 | 待实现 |

板块定义在 `src/shared/boards.ts`，每个板块有独立的系统 prompt（定义在 `src/main/services/prompts.ts`）。

### 板块隔离原则

- 三个板块是三个**独立的对话空间**
- 各自有独立的系统 prompt、工具集、对话历史
- 不能跨板块引用或切换
- 每个板块内有 ChatGPT 式的历史会话列表

## 系统 Prompt 架构

所有板块共享一个基础人格层（身份为 Enso，Alex 的个人助手），再叠加板块特化 prompt。

| 板块 | Prompt 设计意图 |
|------|----------------|
| 深度对话 | 长段落连贯叙述，不回避灰色地带，敢于挑战用户观点，少用编号列表，多用深层追问 |
| 投资决策 | 数据驱动，标注信息来源和日期，区分事实/推测/观点，给出明确倾向性建议，不做免责声明 |
| 科研辅助 | 优先权威数据库（PubMed、Cochrane），引用必带 PMID/DOI，区分研究设计和证据等级，通俗解释统计概念 |

具体 prompt 文本在 `src/main/services/prompts.ts` 中维护，不在本文档中重复。

## 工具体系（规划中）

### 设计原则

使用各家模型原生的 function calling / tool use 能力，通过 Vercel AI SDK 统一接口。模型自己决定：要不要用工具、用哪个、用几次。不用关键词匹配。

单次对话最多 10 轮工具调用（防止失控循环）。

### 工具调用流程

```
用户发消息
    |
构建 messages（系统 prompt + 对话历史 + 用户消息）
    |
发给大模型
    |
大模型回复 --> 纯文字 -> 直接显示
    |
    +---> tool_call -> Enso 执行工具 -> 结果喂回大模型 -> 循环
                                         ^                |
                                         +----------------+
                                     （直到模型不再调工具）
```

### 规划工具清单

| 工具 | 板块 | 实现方式 |
|------|------|---------|
| web_search | 决策、科研 | Tavily API 或 Serper API |
| web_fetch | 决策、科研 | Firecrawl 或 fetch + readability |
| pubmed_search | 科研 | PubMed E-utilities API |
| arxiv_search | 科研 | arXiv API |
| calculate | 决策、科研 | 安全表达式求值 / 简单统计函数 |
| portfolio_read | 决策 | 从 SQLite 读取手动录入的持仓 |
| portfolio_write | 决策 | 写入/更新持仓记录 |
| market_price | 决策 | Yahoo Finance API 或 Alpha Vantage |
| file_write | 决策、科研 | 写入 Enso 工作区文件 |
| file_read | 决策、科研 | 读取用户指定文件 |

深度对话板块**没有工具**。

> 以上工具均未实现。当前三个板块都是纯对话模式。

## 提供商层

四个提供商，用户手动选择，不自动路由：

| 提供商 | SDK | 备注 |
|--------|-----|------|
| OpenAI | `@ai-sdk/openai` | 直连 |
| Anthropic | `@ai-sdk/anthropic` | 直连 |
| Google | `@ai-sdk/google` | Gemini |
| Kimi | `@ai-sdk/moonshotai` | Moonshot 官方 AI SDK provider |

统一通过 Vercel AI SDK 的 `streamText` 进行流式文本生成。

## 数据流

1. 用户在 renderer 输入消息，选择板块和模型
2. renderer 通过 IPC 调用 `enso:chat:send`
3. main process 保存用户消息到 SQLite
4. `ModelAdapter` 构建系统 prompt + 历史消息，调用 `streamText`
5. 流式 chunk 通过 IPC 事件 `enso:chat:stream-chunk` 推送到 renderer
6. 完成后 `enso:chat:stream-end` 推送全文，同时保存助手回复到 SQLite
7. 出错时 `enso:chat:stream-error` 推送错误信息
8. 用户可随时通过 `enso:chat:cancel` 中止流式响应

## 持久化

### SQLite（better-sqlite3）

当前已实现的表：

```sql
-- 会话
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,        -- 'dialogue' | 'decision' | 'research'
  title TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 消息
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,          -- 'user' | 'assistant' | 'tool'
  content TEXT NOT NULL,
  tool_name TEXT,              -- 如果 role='tool'，记录工具名
  created_at TEXT NOT NULL
);

-- 应用状态
CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
```

规划中尚未创建的表：

```sql
-- 持仓（投资板块专用）
CREATE TABLE portfolio (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  shares REAL NOT NULL,
  cost_basis REAL NOT NULL,
  broker TEXT,
  notes TEXT,
  updated_at TEXT
);
```

### 其他存储

- **TOML** (`@iarna/toml`): 提供商配置（model、baseUrl）
- **Electron safeStorage**: API Key 加密存储，AES-256-GCM 回退

## UI 结构

```
+----------------------------------------------+
|  [深度对话]  [投资决策]  [科研辅助]  [设置]     |
+------------+---------------------------------+
|  历史会话   |  对话区域                        |
|  列表      |                                 |
|           |  [消息流...]                      |
|  会话1     |                                 |
|  会话2     |                                 |
|  会话3     |  +---------------------------+  |
|  ...      |  | 输入框        [模型选择 v] |  |
|           |  +---------------------------+  |
+------------+---------------------------------+
```

- 左栏：板块标签 + 当前板块的历史会话列表（可重命名、删除、置顶）
- 右栏：对话消息流 + 输入框 + 模型/提供商选择器
- 设置页：嵌入式，管理各提供商 API Key

## 安全模型

单用户系统，单信任操作员。不设计多租户边界。
API Key 通过 Electron safeStorage 加密，不写入配置文件。
file_write 工具覆盖已有文件时需弹确认框（待实现）。

## 显式不做

- 自动模式检测 / 切换
- 多 agent 协作
- 本地知识库 / RAG 作为核心功能
- 权限分级 / 审计 / 执行流水线
- 对话摘要 / 压缩（50 轮以内，上下文窗口够用）
- 插件系统
- 联网同步
- 打包安装程序（当前阶段）
