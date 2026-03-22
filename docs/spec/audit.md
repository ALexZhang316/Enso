# Audit Spec

> Opus 负责维护本文件。Codex 负责实现并反馈可行性。

## 范围

定义 Enso 审计事件的产出时机、数据结构、存储契约、查询接口。

## 审计事件产出时机

每次请求完成后，无论结果类型如何，都必须写入一条审计记录。

具体触发点：
- 执行序列第 12 步（persist 阶段）
- 确认后执行完成时（追加一条新记录）
- 门控拒绝时（记录 block 决定）

## 审计摘要结构

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

字段说明：
- `id`: UUID，每条记录唯一
- `conversationId`: 关联的会话 ID
- `mode`: 请求处理时的活跃模式
- `retrievalUsed`: 本次请求是否使用了检索
- `toolsUsed`: 本次请求调用的工具名称列表
- `resultType`: 结果类型
  - `answer`: 纯回答（含纯对话和检索增强）
  - `proposal`: 产出了待确认的 PendingAction
  - `dry_run`: 工具执行但无副作用
- `riskNotes`: 风险标记文本（空字符串表示无特殊风险）
- `createdAt`: ISO 8601 时间戳

## 门控审计

每次门控检查必须记录在 trace 中（而非审计表），包含：
- action type
- permission level
- 决定（allow / confirm / block）
- 时间戳

门控 trace 与审计摘要的区别：
- trace 记录执行过程中的每个步骤（包括门控检查）
- audit 记录整个请求的最终摘要

## 存储契约

审计记录存储在 SQLite `audits` 表中：

```sql
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
```

## 查询接口

### 全量查询

返回所有审计记录，按 `created_at` 降序。

### 按会话过滤

接受 `conversationId` 参数，返回该会话的审计记录。

### UI 展示

审计视图（中央面板）展示字段：
- 模式
- 结果类型
- 会话 ID
- 检索使用情况
- 工具使用情况
- 风险标记
- 时间

审计摘要面板（右栏）展示当前请求的：
- 模式
- 检索
- 工具
- 类型
- 风险

## 风险标记规则

以下情况应在 `riskNotes` 中记录：
- 使用了有副作用的工具（workspace-write, exec, external-action）
- 门控检查产出了 block 决定
- 验证结果为 failed
- 工具执行失败

无特殊风险时 `riskNotes` 为空字符串。

## 验收标准

1. 每次请求完成后必须写入审计记录
2. 审计记录必须包含所有 AuditSummary 字段
3. 门控检查必须记录在 trace 中
4. 按会话过滤必须正确工作
5. 审计视图必须展示所有规定字段
6. 风险标记必须覆盖所有规定场景
