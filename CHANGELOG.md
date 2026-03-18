# CHANGELOG

## 2026-03-18 - Workspace proposal-to-execution chain
### What changed
1. Added a minimal `workspace-write` execution path: action-adjacent write requests can now become a visible proposal and, after confirmation, write a file into the Enso workspace.
2. Added `WorkspaceService` to manage the local workspace root and bounded writes under `userData/workspace`.
3. Persisted `pendingAction` in state so confirmation is now a real continuation of execution instead of a state-only acknowledgment.
4. Extended the renderer to show the active workspace root, pending action summary, and a confirmation button that executes the queued workspace write.
5. Added regression coverage for proposal creation, confirmation-driven execution, workspace artifact verification, and end-to-end UI file creation.

### Why it changed
- The previous confirmation flow only cleared the gate state and never executed anything.
- Enso needed a minimal but real proposal -> confirmation -> execution loop without opening host-exec or external side effects.

## 2026-03-18 - Runtime wiring and verification fixes
### What changed
1. Wired `ExecutionFlow` to respect persisted `modeDefaults.retrievalByMode` settings and the per-turn `enableRetrievalForTurn` override.
2. Persisted `retrievedSnippets` into assistant message metadata so the right-panel evidence view can render the latest real snippets.
3. Tightened verification semantics so retrieval/tool turns fail verification when required evidence or tool output is missing.
4. Updated conversation bootstrap/create fallback to use the configured `defaultMode`, and returned that mode to the renderer for new conversations.
5. Added regression coverage in `tests/mvp.integration.test.cjs` and `tests/mvp.ui.test.cjs` for retrieval wiring, verification failure semantics, snippet persistence, and configured default-mode behavior.

### Why it changed
- The UI exposed retrieval/default-mode controls that were not fully connected to runtime behavior.
- The evidence panel had no reliable persisted source after real retrieval runs.
- Verification could incorrectly show success when required evidence was missing.

## 2026-03-18 — 建立规范化开发流程

### 本轮完成了什么

1. **tasks/ 目录** — 新增任务模板 (TEMPLATE.md)、任务索引 (INDEX.md)、第一个真实任务文件 (0001-dev-workflow-system.md)
2. **scripts/check-docs-updated.cjs** — 收尾阶段自动检查三个必更新文档是否已修改
3. **npm scripts** — 新增 preflight (预检)、verify (验证)、postflight (收尾) 三个命令
4. **AGENTS.md** — 新增 "Dev workflow protocol" 节，定义六步开发生命周期
5. **CLAUDE.md** — 新增 "Dev workflow enforcement" 节，要求 Claude 执行预检和收尾
6. **codebase-contract.md** — 交接清单新增任务文件和 postflight 检查项

### 解决的问题

上一轮代码写完后忘记更新 CHANGELOG、TODO_LIMITATIONS、codebase-contract，直到用户追问才补。现在这三个文档的更新被纳入强制收尾流程。

---

## 2026-03-18 — 执行主链路接通

### 本轮完成了什么

1. **检索接入主链路。** execution-flow 在分类为 retrieval-enhanced 或 Research/Decision 模式时，自动调用 knowledgeService.retrieve()，并将检索到的证据作为上下文注入模型调用。
2. **工具接入主链路。** execution-flow 在分类为 tool-assisted 时，调用 toolService.decideAndRun()，将工具结果纳入回复上下文，并在消息元数据中记录工具名和结果摘要。
3. **请求分类器升级。** classifyRequest 现在能正确识别 retrieval-enhanced 和 tool-assisted 两种处理类别，不再把所有非 action-adjacent 请求一律当作 pure-dialogue。
4. **计划/轨迹/验证成为一等公民。** 新增 ExecutionPlan、TraceEntry、VerificationResult 类型定义；execution-flow 每个阶段写入轨迹条目；验证阶段检查检索/工具/模型结果的完整性。
5. **持久化。** state_snapshots 表新增 plan_json、trace_json、verification_json 三列；upsertState/getState 完整读写这些字段。
6. **右侧面板 UI 更新。** 新增计划、执行轨迹、验证结果三个独立区域，与证据/状态/审计并列显示。
7. **消息气泡增强。** 助手消息底部显示检索片段数量、工具名称和工具结果摘要。
8. **修复两个 TypeScript 类型错误。** provider.vendor -> provider.id；ReactMarkdown code 组件 inline prop 兼容性修复。

### 之前 CHANGELOG 中提到的差距，现在消除了几个

| 差距 | 状态 |
|------|------|
| execution-flow.ts 只有两条路径 | 已消除 — 现在有 classify -> plan -> retrieval -> tool -> model -> verification -> gate -> persist 完整链路 |
| tool-service.ts 未接入主链路 | 已消除 |
| 检索未接入执行流 | 已消除 |
| 右栏缺少 plan/trace/verification 视图 | 已消除 |
| plan/trace/verification 未持久化 | 已消除 |

### 仍未消除的差距

| 差距 | 说明 |
|------|------|
| 只有 Kimi 一个 provider 有实际实现 | 不在本轮范围内，优先级低于执行核心 |
| 高权限动作只有门控拦截，没有完整 proposal-to-execution 安全链 | 按设计文档要求先拦截、后执行，当前仅实现拦截阶段 |

---

## 初始交接 — 从旧交接包到计划书 1.0

## 阅读顺序

你拿到的是一份更新过的交接包。在读其他任何文件之前，先读完本文件。
然后按以下顺序阅读：

1. 本文件（CHANGELOG.md）
2. docs/codebase-contract.md ← 新增文件
3. docs/current-baseline.md
4. docs/execution-flow.md
5. 其余文件按 README 中的优先级顺序

## 这次更新改了什么

### 变更一：新增 docs/codebase-contract.md

这是一个全新文件，旧版交接包中不存在。

作用：记录代码层面的硬性约定（目录结构、模块边界、命名风格、数据库 schema、已做的实现决策）。

为什么加这个：旧版交接包只描述"产品应该是什么"，不描述"代码现在长什么样"。当不同 AI 模型轮流开发时，接手的模型只能从文档猜代码结构，容易猜错。这个文件就是用来消除猜测的。

规则：
- 每次你完成一轮开发后，必须更新 codebase-contract.md
- 更新内容包括：目录结构、模块边界登记表、数据库 schema、已知问题、关键实现决策
- 完成交接检查清单中的所有项目后，才算交接完成

### 变更二：产品重心从"认知工作站"转向"执行优先"

旧版交接包的中心是"深度对话"和"个人认知工作站"。
新版交接包将中心移到了"执行优先的个人 agent"。

具体变化：
- 工具调用从"附属功能"提升为"核心能力"
- planner → executor → verifier 成为主链路
- 深度对话从"产品核心"降级为"可选模式之一"
- 新增了权限分级（5 级）、审计写回、显式验证等约束

这些变化已经写在 docs/current-baseline.md 和 docs/revision-notes-2026-03-09.md 中。

### 变更三：模式系统的明确定义

旧版对模式系统的定义比较模糊。新版明确了：
- 必须存在一个 Default 模式，无需用户选择即可使用
- Deep Dialogue / Decision / Research 是三个可选模式，互斥
- 模式不是独立引擎，只是对同一执行核心的行为偏置
- 禁止自动模式路由

## 当前代码与新计划书之间的已知差距

以下是当前仓库代码尚未对齐新计划书的地方。这不是 bug 列表，而是方向性差距。

1. **modes.ts 中没有 Default 模式。** 当前只定义了三个模式（deep-dialogue / decision / research），DEFAULT_MODE 被设为 deep-dialogue。新计划书要求 Default 作为独立模式存在。

2. **execution-flow.ts 只有两条路径。** 当前逻辑：检测到动作意图 → 拦截；否则 → 直接调模型。新计划书要求的 planner、verifier、execution loop、context assembly 均未实现，连 stub 都没有。

3. **tool-service.ts 未接入主链路。** 工具服务已实现 compute / search / read 三个工具，但 execution-flow 中从未调用。

4. **检索未接入执行流。** KnowledgeService.retrieve() 存在且可用，但 execution-flow 在生成回复时不调用检索。

5. **只有 Kimi 一个 provider 有实际实现。** providers.ts 定义了五个 ID，但只有 KimiProvider 有代码。

## 下一轮施工应该做什么

不要同时修复上述所有差距。按以下优先级逐个推进：

**第一步：修复模式系统。**
在 modes.ts 中添加 "default" 模式，将 DEFAULT_MODE 改为 "default"。确保 UI 中的模式切换器正确显示四个状态。

**第二步：在 execution-flow.ts 中补齐骨架。**
为 planner、verifier、context assembly 各创建最小 stub（可以只是函数签名 + 日志输出），让主链路的 13 个阶段至少在代码中有对应的位置，即使大部分是空实现。

**第三步：将 tool-service 接入主链路。**
在 execution-flow 中，当分类结果不是 pure-dialogue 时，调用 toolService.decideAndRun() 并将结果纳入回复上下文。

**第四步：将检索接入执行流。**
在 execution-flow 中，当分类结果为 retrieval-enhanced 或 Research 模式激活时，调用 knowledgeService.retrieve() 并将结果作为上下文注入模型调用。

每完成一步，更新 codebase-contract.md 后再进入下一步。
