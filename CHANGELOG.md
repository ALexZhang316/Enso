# CHANGELOG — 从旧交接包到计划书 1.0

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
