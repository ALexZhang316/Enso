# Brain Spec (Execution Flow)

> Opus 负责维护本文件。Codex 负责实现并反馈可行性。

## 范围

定义单次请求从用户输入到最终响应的完整行为契约。
覆盖：请求解析、计划、执行、验证、门控、持久化。

## 执行序列

每个请求必须依次经过以下阶段。不允许跳过阶段（但阶段可以是空操作）。

| # | 阶段 | Trace phase | 行为 |
|---|------|-------------|------|
| 0 | 请求入口 | - | 接受用户文本输入 |
| 1 | 读取上下文 | classify | 加载：模式、配置、权限策略、工作区策略、会话状态、知识元数据 |
| 2 | 请求分类 | classify | 输出一个 handlingClass: `pure-dialogue` / `retrieval-enhanced` / `tool-assisted` / `action-adjacent` |
| 3 | 计划草案 | plan | 输出：goal, steps[], likelyTools[], verificationTarget |
| 4 | 检索决策 | retrieval | 判断是否需要检索。需要时执行 FTS 查询并返回 evidence bundle |
| 5 | 工具决策 | tool | 判断是否需要工具调用。需要时执行有界工具链 |
| 6 | 上下文组装 | model | 从用户输入 + 模式规则 + 表达规则 + 历史 + 证据 + 工具摘要 + 计划草案组装模型输入 |
| 7 | 模型调用 | model | 调用远程模型产出结构化执行草案 |
| 8 | 执行循环 | tool | 在有界循环内运行检索/工具步骤 |
| 9 | 验证 | verification | 检查声称的结果是否真实存在 |
| 10 | 门控检查 | gate | 按 per-action permission level 决定：allow -> 直接执行；confirm -> 转为 proposal 等待确认；block -> 拒绝 |
| 11 | 响应格式化 | persist | 按表达配置和模式格式化最终响应 |
| 12 | 持久化 | persist | 写入：状态、计划、轨迹、验证结果、审计摘要 |
| 13 | UI 更新 | persist | 中央面板显示响应；右侧面板更新上下文/计划/状态/审计 |

## 请求分类规则

- `pure-dialogue`: 无需检索、工具或外部动作的纯对话
- `retrieval-enhanced`: 依赖文档、证据或上传文件的请求
- `tool-assisted`: 需要工具调用（读取、搜索、计算）但无副作用
- `action-adjacent`: 涉及工作区写入、命令执行或外部操作

分类器不得自动切换模式。

## 计划契约

计划必须包含：

```typescript
interface ExecutionPlan {
  goal: string;          // 一句话目标
  steps: string[];       // 有序步骤列表
  likelyTools: string[]; // 预期使用的工具
  verificationTarget: string; // 验证什么算成功
}
```

纯对话请求可以不生成计划（plan = null）。

## 检索决策规则

- 请求依赖文档/证据/上传文件时 -> 启用
- 纯续话/概念讨论/纯思维对话 -> 跳过
- 模式偏好：Research > Decision > Default > Deep Dialogue
- 用户可通过 per-turn 开关覆盖
- 配置中的 modeDefaults.retrievalByMode 提供模式级默认值

## 工具决策规则

- 工具仅在超越纯生成或检索价值时使用
- 当前工具类型：read, search, compute, workspace-write, exec
- 禁止不受控的多工具级联
- Default 模式保持平衡；Deep Dialogue 默认轻工具；Research 最积极

## 验证规则

- 每次非纯对话请求必须产出验证结果
- 验证状态：`passed` / `failed` / `skipped` / `blocked`
- `skipped` 仅限纯对话路径
- 声称成功但无验证 -> 不允许
- 检索/工具路径缺少证据或工具输出 -> verification = failed

## 门控规则

每种 action type 有独立的 permission level：

| Action Type | 默认级别 | block 行为 | confirm 行为 | allow 行为 |
|-------------|---------|-----------|-------------|-----------|
| workspace_write | confirm | 拒绝，不调用模型生成 proposal | 生成 proposal，等待用户确认 | 直接执行 |
| host_exec_readonly | confirm | 拒绝 | 生成 proposal，等待确认 | 直接执行 |
| host_exec_destructive | block | 拒绝 | 生成 proposal，等待确认 | 直接执行 |
| external_network | block | 拒绝，不发远程请求 | (暂未实现) | 正常发送 |

确认后执行前必须重新加载配置并验证权限未变更。

## 确认解决契约

用户确认 pending action 后：
1. 重新加载配置
2. 重新检查对应 action type 的 permission level
3. 如果 level 变为 block -> 拒绝并记录 trace
4. 否则执行动作并写入审计

## 异常处理

- 模型调用失败 -> 返回错误消息，保留之前的状态
- 工具执行失败 -> 记录 trace，verification = failed
- 配置加载失败 -> 显示错误卡片，阻止交互
- 权限重验证失败 -> 拒绝执行，返回 blocked 状态

## 硬约束

- 不允许自动模式切换
- 不允许隐藏写入操作
- 不允许在权限策略之外静默执行
- 不允许跳过审计写回
- 不允许在无验证的情况下声称成功
- 不允许不受控的多工具循环

## 验收标准

1. 每个请求必须产出分类、计划（或 null）、轨迹、验证结果、审计摘要
2. action-adjacent 请求必须经过门控检查
3. block 级别的操作必须在调用模型之前被拒绝
4. 确认后执行必须重新验证权限
5. 所有执行步骤必须记录在 trace 中
6. 验证必须在持久化之前完成
