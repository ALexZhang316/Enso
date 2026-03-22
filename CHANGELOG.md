# CHANGELOG

## 2026-03-23 - Execution chain wiring, tool reliability, and UI confirmation cleanup
### What changed
1. Wired expression preferences (`density`, `structuredFirst`, `reportingGranularity`) into `ExecutionFlow` and `ModelAdapter`, and switched the model-facing execution draft to a structured JSON contract with graceful plain-text fallback.
2. Expanded tool execution so `tool-service` now emits structured tool results, `workspace-service` exposes explicit in-workspace path validation and real writes, and `host-exec-service` captures stdout/stderr/exit code with a configurable timeout.
3. Cleaned up the shell-facing shared mode/permission labels, added a center-pane confirmation card with confirm/reject actions, and added renderer/main-process wiring for rejecting pending confirmations with a visible chat result.
4. Extended regression coverage across integration and UI tests for expression prompt injection, structured draft parsing, malformed draft fallback, workspace-write rejection, structured host-exec results, timeout handling, right-rail plan/trace rendering, and center-pane confirm/reject flows.

### Why it changed
- The execution chain was still ignoring persisted expression settings and relying on free-form model output where a typed draft was expected.
- Tool execution needed to move from partial stubs to structured, verifiable results before the planner -> executor -> verifier backbone can be trusted.
- The shell already exposed pending confirmations and right-rail state, but the center-pane interaction path and shared labels still had obvious product-level rough edges.

## 2026-03-22 - Collaboration protocol internalized and workflow docs aligned
### What changed
1. Added `docs/collaboration-protocol.md` to internalize the Alex / Claude / Codex role split, review flow, handoff rules, and actual Enso path ownership inside the repository.
2. Updated `AGENTS.md`, `CLAUDE.md`, `README.md`, and `docs/codebase-contract.md` so the new collaboration protocol and `docs/spec/*.md` behavioral source-of-truth model are reflected consistently.
3. Fixed `tasks/TEMPLATE.md`, `tasks/0002-permission-boundary-rework.md`, and `tasks/INDEX.md` so they no longer point at removed legacy docs and now reflect the spec/review vs implementation/integration split.
4. Extended `scripts/check-docs-updated.cjs` to scan the new collaboration doc and to flag stale references to removed legacy behavior-doc paths in workflow artifacts.

### Why it changed
- The repo had already been moved toward a layered spec/implementation split, but the collaboration contract still lived outside the repository and several workflow files still referenced deleted docs.
- Without an internal collaboration doc, the new responsibility split was only partially durable.
- The task template and backlog metadata needed to match the new doc system or future work would immediately drift back to the old model.

## 2026-03-22 - Documentation restructuring with modular spec layer
### What changed
1. Created `docs/spec/` directory with 6 modular behavioral spec files: `brain.md` (execution flow), `permission.md` (permission model), `context.md` (knowledge/retrieval/state), `tools.md` (tool orchestration), `ui.md` (UI interaction), `audit.md` (audit events).
2. Merged `docs/current-baseline.md` and `docs/windows-product-spec.md` into `docs/baseline.md`.
3. Deleted redundant docs: `execution-flow.md`, `module-spec-table.md`, `ui-layout.md`, `windows-product-spec.md`, `current-baseline.md`.
4. Introduced a 4-tier document authority system in `AGENTS.md`: live sources > behavioral specs > code-layer contract > reference.
5. Created `docs/reviews/` and `docs/handoffs/` directories for future collaboration artifacts.
6. Simplified `CLAUDE.md` to a focused Claude-specific constraint file with pointer to `AGENTS.md`.
7. Updated `README.md`, `docs/codebase-contract.md`, and `scripts/check-docs-updated.cjs` to reflect the new structure.

### Why it changed
- Behavioral rules were scattered across multiple overlapping docs with no clear ownership boundary.
- The new spec layer separates behavioral contracts (what the system must do) from component boundaries (where things live), aligning with the three-role collaboration protocol: Opus writes specs, Codex implements, Alex decides.
- Consolidating baseline docs and deleting redundant files reduces maintenance cost and eliminates conflicting information.

## 2026-03-22 - GitHub CLI becomes required bootstrap dependency
### What changed
1. Updated `scripts/bootstrap-git.ps1` to require both `git` and GitHub CLI (`gh`) before bootstrap work begins.
2. Added a GitHub authentication check to bootstrap so the script now fails fast until `gh auth status` succeeds.
3. After binding `origin`, the bootstrap script now automatically runs `gh repo set-default origin` and prints the linked default repository.
4. Updated `docs/environment-and-github-bootstrap.md`, `README.md`, `TODO_LIMITATIONS.md`, and `docs/codebase-contract.md` to reflect the new GitHub dependency and bootstrap behavior.

### Why it changed
- The repo already had a Git bootstrap shortcut, but GitHub itself was still treated as optional setup.
- Making `gh` a required dependency gives the repo one supported path for binding both git remotes and GitHub CLI context to the current repository.
- Automatic GitHub repo linking removes one more manual bootstrap step on a new machine.

## 2026-03-22 - Contract cleanup, stale doc deletion, and task cleanup
### What changed
1. Rewrote `docs/codebase-contract.md` into a clean current-state contract instead of a layered history log, and removed the old garbled legacy section.
2. Deleted the obsolete reference docs `docs/iteration-guidance.md` and `docs/revision-notes-2026-03-09.md`.
3. Kept `README.md` as a human-readable overview, but synced its onboarding and reference-doc lists to the current repo state instead of shrinking it.
4. Removed outdated completed task files from `tasks/`, leaving only the active implementation brief `tasks/0002-permission-boundary-rework.md` plus `INDEX.md` and `TEMPLATE.md`.
5. Updated `AGENTS.md`, `CLAUDE.md`, `README.md`, `tasks/INDEX.md`, `TODO_LIMITATIONS.md`, and `docs/codebase-contract.md` to stay consistent with the deletions.

### Why it changed
- `docs/codebase-contract.md` had become the highest-concentration source of redundancy, stale history, and garbled text in the repo.
- `docs/iteration-guidance.md` and `docs/revision-notes-2026-03-09.md` were no longer earning their maintenance cost.
- The `tasks/` folder had accumulated completed task records that no longer helped active execution.

## 2026-03-22 - Reference doc pruning for product spec, module table, and UI layout
### What changed
1. Pruned `docs/windows-product-spec.md` so it now keeps only desktop-specific details that are not already covered by the three live source docs.
2. Removed repeated product identity, mode-system, shared-execution-core, and main-window layout sections from `docs/windows-product-spec.md`.
3. Reduced `docs/module-spec-table.md` to a pure module inventory by removing the duplicated product-direction and use-case preamble.
4. Updated `docs/ui-layout.md` to state explicitly that it is the single detailed layout reference for the Windows three-panel shell.
5. Recorded the doc-pruning round in the repo contract and limitations docs, and added an in-repo task record.

### Why it changed
- These three reference docs still contained obvious duplication after the live source docs were reduced to three.
- `windows-product-spec.md` was repeating material that already belongs to `current-baseline`, `execution-flow`, or `architecture`.
- `ui-layout.md` is more useful when it is clearly the only detailed layout document instead of one of several overlapping layout descriptions.

## 2026-03-22 - Live source docs reduced to three
### What changed
1. Reduced the repo's live source-of-truth docs to three files only: `docs/current-baseline.md`, `docs/execution-flow.md`, and `docs/architecture.md`.
2. Updated `AGENTS.md` so only those three docs participate in conflict resolution.
3. Downgraded `windows-product-spec`, `module-spec-table`, `ui-layout`, `iteration-guidance`, `revision-notes-2026-03-09`, and `openclaw-reference-notes` to reference-only status.
4. Updated `CLAUDE.md` to mirror the same three-doc live source model.
5. Added `tasks/0006-live-source-doc-reduction.md` and updated `tasks/INDEX.md` to track the contract change in-repo.

### Why it changed
- Earlier pruning still left too many documents with apparent source-of-truth authority.
- Real simplification requires reducing the number of live authority documents, not just reorganizing them.
- This change makes future conflict resolution simpler and lowers documentation maintenance cost.

## 2026-03-22 - AGENTS pruning pass
### What changed
1. Pruned `AGENTS.md` again by removing the redundant external-handoff wording and deleting the standalone `How to use this file` section.
2. Clarified the `CLAUDE.md` condition in plain language: only read it when the active coding client actually uses `CLAUDE.md`.
3. Removed the repo-direction slogan lines about execution-first versus dialogue identity from the live repo contract.
4. Removed the standalone `EXECUTE` section from the repo workflow protocol and simplified the loop wording to `PREFLIGHT -> PLAN -> WORK -> VERIFY -> POSTFLIGHT -> DONE`.
5. Updated `CLAUDE.md`, `docs/codebase-contract.md`, and task tracking docs to stay aligned with the simplified contract.

### Why it changed
- The previous simplification still carried wording the user considered redundant or too ceremonial.
- The repo contract should stay lean, readable, and clearly subordinate to the global AGENTS rules.
- Repo-local workflow text should explain only what is truly specific to this repository.

## 2026-03-22 - Global AGENTS alignment and repo-contract simplification
### What changed
1. Simplified `AGENTS.md` again so the global AGENTS rules are now explicitly the primary execution reference, while the repo file only adds repo-specific boundaries, verification surfaces, and doc-update rules.
2. Removed the acceptance-level taxonomy from the repo workflow contract and replaced it with a simpler normal-completion standard plus a separate release or milestone gate.
3. Simplified `tasks/TEMPLATE.md` so it records a verification plan instead of requiring an acceptance-level classification.
4. Updated `CLAUDE.md` to mirror the same positioning and reduced local workflow overhead.
5. Added `tasks/0004-global-agents-alignment.md` and updated `tasks/INDEX.md` so the workflow-contract simplification is tracked in-repo.

### Why it changed
- The previous rewrite still added too much local process structure and was more cautious than the global execution baseline.
- The repo contract should supplement the global rules, not compete with them.
- This keeps repo instructions focused on what is truly repo-specific instead of re-specifying generic execution behavior.

## 2026-03-22 - AGENTS workflow contract rewrite
### What changed
1. Rewrote `AGENTS.md` into a more execution-oriented contract organized around working stance, preserved boundaries, acceptance levels, and workflow phases.
2. Replaced the old one-size-fits-all stop-condition model with four acceptance levels: Level 0 doc/text, Level 1 scoped implementation, Level 2 system-surface change, and Level 3 milestone/release.
3. Relaxed preflight and postflight handling for doc-only and small scoped tasks by allowing recorded baselines and doc-check fallbacks when unrelated repo-wide red tests are already known.
4. Updated `CLAUDE.md` to mirror the same acceptance-level and fallback logic instead of reintroducing a stricter contract on the client side.
5. Updated `tasks/TEMPLATE.md` and added `tasks/0003-agents-workflow-rewrite.md` so task artifacts now follow the new less-conservative workflow contract.
6. Recorded the workflow rewrite in `docs/codebase-contract.md` and refreshed `TODO_LIMITATIONS.md` to reflect the new operating model.

### Why it changed
- The previous workflow still behaved too much like a release checklist even after earlier relaxations.
- It encouraged agents to over-verify, over-document, and treat every task as if it needed repo-wide green proof.
- The new contract keeps strong proof where it matters while making small and medium tasks faster to execute honestly.

## 2026-03-21 - Workflow constraint relaxation and bounded autopilot
### What changed
1. Updated `AGENTS.md` so clear, bounded tasks now bias toward direct execution instead of extended planning and process artifact churn.
2. Allowed scoped work to continue when `preflight` or `verify` are already red because of known unrelated regressions, as long as the agent records the baseline and runs relevant targeted verification.
3. Relaxed the repo rule that forced task-file creation and mandatory tri-doc updates for every small change; the new rule is to create/update them when the task materially changes behavior, limitations, or repo contract.
4. Updated `CLAUDE.md` to mirror the same execution-first, lower-friction workflow so Claude-side behavior stays aligned with the repo contract.
5. Upgraded the repo's execution bias into a bounded-autopilot rule: once scope and stop condition are clear, the agent should continue through inspect -> modify -> verify -> repair loops instead of stopping at the first red result.

### Why it changed
- The prior workflow constraints were accurate but too conservative for clear, bounded tasks.
- Excess process overhead was slowing real task progress and causing the agent to spend too much time on meta work instead of implementation.
- The desired operating mode is now long-running, bounded autonomy rather than cautious single-step execution.

## 2026-03-21 - Added executable task brief for permission boundary rework
### What changed
1. Added `tasks/0002-permission-boundary-rework.md` as the repo-local execution brief for the next implementation round.
2. Captured the agreed target model for permission handling: front-loaded permission checks, separate `model_call` vs `local_egress`, stricter host-exec boundary handling, and real `allow / confirm / block` semantics.
3. Updated `tasks/INDEX.md` so the permission-boundary rework is now the active ready task instead of remaining only in chat discussion.

### Why it changed
- The permission discussion had converged enough that the next agent should not need to reconstruct requirements from chat history.
- The repo workflow expects objective, scope, and acceptance criteria to be encoded into a reusable task artifact.

## 2026-03-21 - Multi-provider runtime implementation
### What changed
1. Added concrete runtime providers for OpenAI, DeepSeek, Anthropic, and Gemini instead of only exposing them as settings presets.
2. Refactored Kimi onto the shared OpenAI-compatible provider path and added common HTTP/error parsing utilities for provider integrations.
3. Updated `ModelAdapter` so missing-key errors reference the active provider label instead of hardcoding Kimi.
4. Expanded integration coverage with response-shape tests for OpenAI, DeepSeek, Anthropic, and Gemini, plus the existing provider-preset parity regression.

### Why it changed
- The settings UI was advertising provider choices the runtime could not execute.
- Users could save non-Kimi providers and only discover the mismatch after submitting a request.
- Provider support needed to move from placeholder config surface to actual runnable backend wiring.

## 2026-03-21 - Regression coverage expansion for permission gaps and retrieval wiring
### What changed
1. Expanded `tests/integration.test.cjs` to cover provider-preset/runtime parity, workspace_write allow/block semantics, host_exec_readonly allow/block semantics, outside-workspace host-exec rejection, and external_network blocking.
2. Updated model-backed happy-path integration tests to explicitly set `external_network = "allow"` instead of depending on the current runtime bug where remote model calls ignore the default `block` permission.
3. Extended `tests/ui.test.cjs` to preload a network-allowed config for model-backed UI flows and to cover `knowledge import -> retrieval -> evidence panel` end-to-end in the desktop shell.

### Why it changed
- The review identified real permission-boundary defects, but the official regression suite did not prove those boundaries.
- Positive tests were implicitly relying on incorrect behavior from the permission system, which would make future fixes look like regressions.
- Knowledge import was wired in the product shell but still lacked an end-to-end UI regression covering retrieval evidence visibility.

## 2026-03-20 - Per-action permission model
### What changed
1. Replaced three boolean permission flags (readOnlyDefault, requireConfirmationForWrites, requireDoubleConfirmationForExternal) with a per-action-type permission map.
2. Four action types: workspace_write, host_exec_readonly, host_exec_destructive, external_network.
3. Three permission levels per action: allow (direct), confirm (ask once), block (never).
4. Settings panel renders a permission table with one dropdown per action type.
5. Execution flow gate checks now read `config.permissions.workspace_write` instead of boolean combinations.

### Why it changed
- Three booleans had overlapping semantics and ambiguous combinations (readOnlyDefault vs requireConfirmationForWrites).
- Per-action model is extensible: adding new action types requires one new row, not new booleans.
- "Double confirmation" was a UX pattern, not a security boundary; replaced by the clearer allow/confirm/block distinction.

## 2026-03-20 - Expression preferences and reporting granularity redesign
### What changed
1. Replaced old 4-field expression config (style, reducedQuestioning, defaultAssumption, riskLabeling) with `density` (concise/standard/detailed) and `structuredFirst` (checkbox).
2. Added top-level `reportingGranularity` (plan-level / result-level) controlling how much the agent interrupts during execution.
3. Updated config normalization, default.toml, settings panel, browser mock, and right-rail context display.

### Why it changed
- Old expression fields were generic and disconnected from real user needs.
- Reporting granularity addresses the pain of step-by-step confirmation prompts.

## 2026-03-20 - Mode selector UI: implicit default, toggle optional modes
### What changed
1. Removed the explicit "默认" button from the mode selector; default mode is now the implicit baseline when no optional mode is active.
2. Deep Dialogue, Decision, and Research are now independent toggle buttons -- click to activate, click again to deactivate (returns to default).
3. Center pane header hides the mode label when in default mode; right rail shows "Enso" instead of "默认".
4. Settings panel no longer offers a "默认模式" dropdown; `defaultMode` is always forced to `"default"` in config normalization.
5. Retrieval checkboxes in settings now only show the three optional modes.

### Why it changed
- The "默认" button occupied space without adding value -- default is the natural state, not an active choice.
- The toggle interaction (like Claude's extended thinking) is more intuitive for optional behavioral modes.

## 2026-03-19 - Host exec proposal-to-execution expansion
### What changed
1. Added a bounded `host_exec` confirmation chain for read-only PowerShell commands inside the Enso workspace.
2. Added `HostExecService` to validate allowed commands, execute them after confirmation, and verify exit status.
3. Extended `PendingAction` beyond `workspace_write` so the renderer and execution flow can carry either workspace writes or host exec proposals.
4. Added regressions for safe host exec confirmation/execution, destructive host exec blocking, and the visible UI confirmation flow for host commands.

### Why it changed
- The proposal-to-execution path previously stopped at workspace writes, leaving `exec` as a documented capability without a real confirmed execution chain.
- Enso needed a safer intermediate step before any broader external-action support: explicit, read-only commands, scoped to the local workspace, under visible confirmation.

## 2026-03-19 - Core correctness fixes
### What changed
1. Added strict runtime validation to `ConfigService`; invalid `config.toml` values now raise explicit config errors instead of silently falling back to defaults.
2. Added a blocking renderer init-error state so invalid config now renders a clear recovery card with the config path, validation reason, and a reload action.
3. Narrowed action-adjacent request detection so informational prompts like "Can you update me on..." and "How do I write..." stay on the dialogue path, while real workspace-write and side-effect requests remain gated.
4. Expanded regression coverage for invalid config handling, informational action wording, and init-error recovery.
5. Upgraded `preflight` and `verify` to run `test:all`, bringing UI automation into the formal acceptance path.

### Why it changed
- The app could previously boot with an invalid config and quietly drift to defaults, hiding configuration bugs.
- Action gating was too broad and could incorrectly block normal questions.
- The official verification script did not cover the UI stop conditions that the repository contract depends on.

## 2026-03-19 - Gate regression coverage expansion
### What changed
1. Added an integration regression for unsupported action requests so blocked side-effect attempts now assert `action-adjacent` classification, blocked verification, persisted trace phases, and proposal-style audit output.
2. Extended the UI automation flow to verify blocked actions in the renderer, including the blocked assistant response, right-rail verification state, trace entry, audit summary, and the absence of a confirmation button.

### Why it changed
- The core correctness fixes narrowed action detection, but the repository still lacked direct regressions proving unsupported side-effect requests stay blocked end-to-end.
- The right rail is part of the product contract, so blocked-action behavior needed visible UI coverage instead of only service-level assertions.

## 2026-03-19 - Local retrieval quality upgrade
### What changed
1. Added a local SQLite FTS search index for knowledge chunks and wired retrieval to prefer full-text search over plain `LIKE` scanning.
2. Kept the existing keyword search path as a compatibility fallback when the full-text index is unavailable.
3. Added a regression that verifies exact phrase matches outrank looser keyword-only hits.

### Why it changed
- Retrieval quality was still limited to lightweight keyword counting, which made exact phrase queries less reliable than they should be.
- Enso needed a local-first improvement that strengthens evidence retrieval without adding external services or changing the product boundary.

## 2026-03-19 - Remove redundant acceptance checklist file
### What changed
1. Removed the redundant standalone acceptance checklist from the repository root.
2. Kept the active acceptance source in the existing repo contract: `AGENTS.md` stop conditions plus the scripted verification flow.

### Why it changed
- The file was not referenced by the repository and had become a redundant side document.
- Its contents were garbled and weaker than the active in-repo source of truth.

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
5. Added regression coverage in `tests/integration.test.cjs` and `tests/ui.test.cjs` for retrieval wiring, verification failure semantics, snippet persistence, and configured default-mode behavior.

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
