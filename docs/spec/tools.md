# Tools Spec (Tool Orchestration)

> Opus 负责维护本文件。Codex 负责实现并反馈可行性。

## 范围

定义工具注册、路由、执行、失败处理的行为契约。

## 工具类型

| 类型 | 含义 | 副作用 | 门控 |
|------|------|--------|------|
| read | 读取文件/数据 | 无 | 无需 |
| search | 搜索/查询 | 无 | 无需 |
| compute | 计算/转换 | 无 | 无需 |
| workspace-write | 向工作区写入文件 | 有 | 按 workspace_write permission |
| exec | 执行主机命令 | 有 | 按 host_exec_readonly / host_exec_destructive permission |
| external-action | 外部网络操作 | 有 | 按 external_network permission |

## 工具路由原则

- 工具仅在超越纯生成或检索价值时使用
- 优先选择副作用最小的工具类型
- 禁止不受控的多工具级联
- 当前阶段：单工具调用，不支持工具链

## 工具执行契约

### 输入

工具调用由 execution engine 根据计划和模型草案决定。

### 输出

```typescript
interface ToolRunResult {
  toolName: string;
  success: boolean;
  output: string;
  error?: string;
}
```

### 执行边界

- 有界循环：当前阶段最大步数由实现层决定
- 遇到确认要求时停止
- 遇到失败阈值时停止
- 遇到策略阻止时停止

## 工作区写入工具

### 行为

1. 检查 workspace_write permission level
2. block -> 立即拒绝
3. allow -> 生成内容并直接写入
4. confirm -> 生成 proposal（包含 targetPath 和 content），等待确认

### Proposal 内容

```typescript
{
  kind: "workspace_write",
  summary: string,      // 人类可读的操作描述
  targetPath: string,   // 工作区内的目标路径
  content: string       // 将写入的内容
}
```

### 路径约束

- targetPath 必须在 Enso 工作区根目录内
- 不允许写入工作区外的路径

## Host Exec 工具

### 行为

1. 验证命令在白名单内（见 permission.md）
2. 验证工作目录和参数路径在工作区内
3. 检查 host_exec_readonly permission level
4. block -> 拒绝
5. allow -> 直接执行
6. confirm -> 生成 proposal，等待确认

### 安全边界

详见 permission.md 的 Host Exec 安全边界章节。

## 失败处理

- 工具执行失败 -> 记录 trace，设置 verification = failed
- 工具输出为空 -> 根据上下文判断是否为正常结果
- 工具超时 -> 视为失败（实现层决定超时阈值）

## 重试策略

当前阶段：不自动重试。失败即记录并终止该工具步骤。
未来可考虑：有界重试，最大 1 次，仅限瞬态错误。

## 验收标准

1. 每种工具类型必须在 tool registry 中注册
2. 有副作用的工具必须经过权限门控
3. 工具执行结果必须记录在 trace 中
4. 工具失败必须导致 verification = failed
5. 工作区写入必须限制在 Enso 工作区内
6. Host exec 必须验证命令白名单和路径边界
7. 不允许不受控的多工具循环
