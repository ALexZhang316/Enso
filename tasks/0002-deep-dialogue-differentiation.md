# Task 0002: 深度对话模式行为差异化

## Status
ready

## Ownership
- Decision owner: Alex
- Spec / review owner: Claude (Opus)
- Implementation / integration owner: Codex / Claude

## Objective

让深度对话模式从"只是个标签"变成"可感知的不同体验"。用户切到深度对话后，模型应该：说话方式不同、记住更多上下文、少用工具、少追问。所有改动通过 system prompt 注入和执行流参数调整实现，不涉及新的基础设施。

## 问题分析

当前深度对话与默认模式的唯一区别是 `retrievalDefault: false`。以下四个维度完全没有差异化：

1. **System Prompt**：模型不知道自己在哪个模式，收到的指令完全相同
2. **历史窗口**：固定 12 条消息，对长对话连续性不够
3. **工具倾向**：工具触发逻辑无模式区分，深度对话中不需要频繁调工具
4. **澄清阈值**：模型会像默认模式一样追问，打断对话流

## Acceptance criteria

### System Prompt 模式特化
- [ ] `model-adapter.ts` 的 `buildSystemPrompt` 接收 `mode: ModeId` 参数
- [ ] 深度对话模式注入连续性导向的 prompt：强调保持对话流、减少追问、重视概念深度、用自然的对话语气而非报告语气
- [ ] 默认模式保持现有 prompt 不变
- [ ] Decision / Research 模式可以先注入一句简单的角色提示（不是本任务重点，但接口要到位）

### 历史窗口扩大
- [ ] `modes.ts` 每个模式新增 `historyWindow: number` 属性（default: 12, deep-dialogue: 24, decision: 12, research: 16）
- [ ] `execution-flow.ts` 和 `model-adapter.ts` 使用模式对应的 historyWindow 替代硬编码 12

### 工具倾向降低
- [ ] `modes.ts` 每个模式新增 `toolBias: "eager" | "balanced" | "minimal"` 属性（default: "balanced", deep-dialogue: "minimal", decision: "balanced", research: "eager"）
- [ ] `execution-flow.ts` 的请求分类逻辑中，当 toolBias 为 "minimal" 时，仅在用户文本包含明确工具提示词时才触发工具（提高触发门槛）

### 澄清阈值
- [ ] 通过 system prompt 实现：深度对话模式 prompt 中明确指示"不要追问确认，除非信息严重不足以继续；宁可基于合理推测推进对话"

### 测试
- [ ] 新增集成测试：验证深度对话模式的 system prompt 包含连续性相关关键词
- [ ] 新增集成测试：验证深度对话模式的历史窗口为 24
- [ ] 新增集成测试：验证深度对话模式下工具触发门槛更高（普通文本不触发工具）
- [ ] 现有测试无回归
- [ ] `npm run build && npm run test:all` 通过

## Verification plan

- `npm run build` 成功
- `npm run test:all` 全部通过
- 集成测试证明：
  - 深度对话模式的 system prompt 与默认模式不同
  - 历史窗口根据模式变化
  - 深度对话中普通对话文本不触发工具调用

## Files in scope

| 文件 | 改动 |
|------|------|
| `src/shared/modes.ts` | 新增 `historyWindow`、`toolBias` 属性，导出查询函数 |
| `src/main/services/model-adapter.ts` | `buildSystemPrompt` 接收 mode，注入模式特化 prompt |
| `src/main/core/execution-flow.ts` | 历史窗口和工具触发门槛根据模式调整 |
| `tests/integration.test.cjs` | 新增深度对话行为测试 |
| `docs/spec/brain.md` | 更新模式差异化规范 |
| `docs/spec/context.md` | 更新历史窗口规范 |
| `CHANGELOG.md` | 记录改动 |
| `TODO_LIMITATIONS.md` | 更新 |
| `docs/codebase-contract.md` | 更新 |

## Files out of scope

- 记忆/背景连续性系统（spec 标记为 deferred）
- Decision / Research 模式的完整特化（本任务只铺接口）
- UI 层无改动
- 嵌入/向量检索
- 版本号变更（由 Alex 在 MVP 验收后决定）

## Pre-flight checklist
- [ ] Read AGENTS.md
- [ ] Read docs/collaboration-protocol.md
- [ ] Read docs/baseline.md
- [ ] Read docs/architecture.md
- [ ] Read relevant docs/spec/*.md
- [ ] Read docs/codebase-contract.md
- [ ] Confirmed codebase-contract matches actual code
- [ ] Recorded `npm run preflight` baseline, or explicitly justified reusing/skipping the full repo gate
- [ ] Stated scope and planned verification to the user

## Post-flight checklist
- [ ] Objective and acceptance criteria are satisfied
- [ ] Targeted verification ran and was recorded
- [ ] Broader checks ran if the claim required them, or the gap was explained
- [ ] CHANGELOG.md updated if materially affected
- [ ] TODO_LIMITATIONS.md updated if materially affected
- [ ] docs/codebase-contract.md updated if materially affected
- [ ] AGENTS.md / CLAUDE.md / docs/collaboration-protocol.md updated if the workflow contract changed
- [ ] docs/handoffs/<branch-name>.md updated if a branch handoff record adds real value
- [ ] `npm run postflight` passed, or a known unrelated red baseline plus a successful doc-check fallback was recorded
- [ ] No unintended file changes (git diff reviewed)

## Notes

- 所有模式差异化都通过数据驱动（modes.ts 属性）+ prompt 注入实现，不引入新的控制流分支或基础设施
- 深度对话的 system prompt 应该用中文写，因为目标用户是中文用户
- historyWindow 和 toolBias 作为模式属性定义后，Decision 和 Research 的特化在后续任务中只需调整这些属性值和对应 prompt 即可
