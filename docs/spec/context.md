# Context Spec (Knowledge / Retrieval / State)

> Opus 负责维护本文件。Codex 负责实现并反馈可行性。

## 范围

定义知识导入、分块、检索、上下文组装、状态持久化的行为契约。

## 知识导入

- 用户通过文件对话框选择本地文件导入
- 支持的格式由实现层决定（当前阶段：文本文件）
- 导入流程：读取文件 -> 分块 -> 写入 SQLite -> 写入 FTS 索引
- 每个来源记录：id, name, path, chunkCount, createdAt
- 分块策略由实现层决定（当前：固定大小分块）

## 检索管线

### 触发条件

按 brain.md 中的检索决策规则。简述：
- 请求依赖文档/证据 -> 启用
- 模式偏好影响默认行为
- 用户 per-turn 开关可覆盖

### 检索方法

当前阶段使用 jieba 中文分词 + SQLite FTS5 + 关键词回退：

1. 将查询用 jieba 分词拆分为 terms（中文按词粒度，英文按空格/标点）
2. 索引端：内容写入 FTS5 前经过 jieba 预分词（空格分隔），让 unicode61 tokenizer 按词级切分
3. 优先使用 FTS5 BM25 排序
4. FTS5 不可用时回退到 LIKE 关键词匹配
5. 对结果计算综合分数：phrase boost + term match + BM25
6. 按分数降序返回 top-N 片段

向量/嵌入检索延后。

### 检索输出

```typescript
interface RetrievedSnippet {
  chunkId: string;
  sourceId: string;
  sourceName: string;
  sourcePath: string;
  content: string;   // 截断到 600 字符
  score: number;
}
```

检索结果附加到 assistant 消息的 metadata 中，以便 UI 展示。

## 上下文组装

模型输入从以下来源组装：
- 用户当前输入
- 模式规则
- 表达规则（density, structuredFirst）
- 最近对话历史（最近 12 条）
- 证据 bundle（检索结果）
- 工具摘要
- 当前任务状态
- 当前计划草案

目标：最小充足上下文。不做全文档注入。

## 状态持久化

### 会话状态 (StateSnapshot)

```typescript
interface StateSnapshot {
  conversationId: string;
  retrievalUsed: boolean;
  toolsCalled: string[];
  latestToolResult: string;
  pendingConfirmation: boolean;
  pendingAction: PendingAction | null;
  taskStatus: "idle" | "processing" | "completed" | "awaiting_confirmation";
  updatedAt: string;
  plan: ExecutionPlan | null;
  trace: TraceEntry[];
  verification: VerificationResult | null;
}
```

每次请求完成后写入 state_snapshots 表。

### 轨迹 (TraceEntry)

```typescript
interface TraceEntry {
  phase: "classify" | "plan" | "retrieval" | "tool" | "model" | "verification" | "gate" | "persist";
  summary: string;
  timestamp: string;
}
```

轨迹记录执行序列中每个有意义的步骤。

### 审计摘要 (AuditSummary)

```typescript
interface AuditSummary {
  id: string;
  conversationId: string;
  mode: ModeId;
  retrievalUsed: boolean;
  toolsUsed: string[];
  resultType: "answer" | "proposal" | "dry_run";
  riskNotes: string;
  createdAt: string;
}
```

每次请求完成后写入 audits 表。

## 记忆策略

当前阶段：
- 不启用自动增长的长期人格记忆
- 配置、知识、状态、工作区、审计持久化
- 可选：手动维护的背景 profile slot（延后）

模式对记忆的影响（延后实现）：
- Deep Dialogue 更积极读取连续性背景
- Decision 偏好用户偏好/约束记忆
- Research 偏好任务上下文记忆
- Default 保持平衡

## 验收标准

1. 文件导入必须完成分块和 FTS 索引写入
2. 检索必须返回按相关性排序的片段
3. 短语完全匹配必须优先于松散关键词匹配
4. 检索结果必须附加到 assistant 消息 metadata
5. 状态快照必须在每次请求后持久化
6. 轨迹必须包含所有执行阶段的记录
7. 审计摘要必须在每次请求后写入
