# Architecture v0.3.4

## 一句话架构

主聊天窗口 -> 请求解析 -> 规划器 -> 执行引擎 -> 验证器 -> 可见结果 + 审计

所有环节受本地策略、本地状态、本地工作区控制。

## 组件边界图

```text
+------------------+     +------------------+     +------------------+
|   Interface      |     |   Core Runtime   |     |   Supporting     |
|   Layer          |     |                  |     |   Systems        |
+------------------+     +------------------+     +------------------+
| Desktop UI       |     | Request Parser   |     | Config/Policy    |
|  - conversation  |---->|  - classify      |     |  - TOML load     |
|  - file import   |     |  - handling class|     |  - schema valid  |
|  - mode switch   |     +--------+---------+     +------------------+
|  - plan/state    |              |               | Knowledge (RAG)  |
|  - confirmation  |              v               |  - file import   |
+------------------+     +--------+---------+     |  - chunking      |
                         | Planner          |     |  - FTS retrieval |
                         |  - goal          |     +------------------+
                         |  - steps         |     | Workspace        |
                         |  - likely tools  |     |  - local root    |
                         |  - verify target |     |  - bounded write |
                         +--------+---------+     +------------------+
                                  |               | State            |
                                  v               |  - plan          |
                         +--------+---------+     |  - trace         |
                         | Execution Engine |     |  - pending       |
                         |  - retrieval     |     |  - verification  |
                         |  - tool calls    |     +------------------+
                         |  - bounded loop  |     | Audit            |
                         |  - stop on gate  |     |  - per-request   |
                         +--------+---------+     |  - gate records  |
                                  |               +------------------+
                                  v               | Provider Layer   |
                         +--------+---------+     |  - Kimi          |
                         | Verifier         |     |  - OpenAI        |
                         |  - artifact check|     |  - DeepSeek      |
                         |  - evidence check|     |  - Anthropic     |
                         |  - exit status   |     |  - Gemini        |
                         +--------+---------+     +------------------+
                                  |
                                  v
                         +--------+---------+
                         | Gate Check       |
                         |  - allow/confirm |
                         |  - block/reject  |
                         +------------------+
```

## 核心运行时

- **请求解析器**: 分类为 handling class (pure-dialogue / retrieval-enhanced / tool-assisted / action-adjacent)。不自动切换模式。
- **规划器**: 产出有界可检视的计划（goal / steps / likelyTools / verificationTarget）。
- **执行引擎**: 按计划、模式偏置、权限策略、工作区规则执行。遇到确认要求 / 失败阈值 / 策略阻止时停止。
- **验证器**: 检查声称的结果是否真实存在。
- **门控检查**: 按 per-action permission level 决定 allow / confirm / block。

## 支持系统

- **配置/策略**: TOML 加载、schema 验证。无效配置不允许静默改变行为。
- **知识层 (RAG)**: 本地文件导入 -> 分块 -> SQLite FTS 检索。向量/嵌入延后。
- **工作区**: 本地执行区域，写入默认安全区。
- **状态层**: 当前任务状态、计划、工具记录、中间输出、待确认、验证状态。
- **审计层**: 输入/模式/分类/计划/检索/工具/验证/响应/风险标记。
- **提供商层**: 多提供商抽象，当前支持 Kimi / OpenAI / DeepSeek / Anthropic / Gemini。

## 模式系统

模式是行为偏置，不是产品身份。始终有且仅有一个活跃模式。

| 模式 | 工具倾向 | 检索倾向 | 核心特征 |
|------|---------|---------|---------|
| Default | 平衡 | 平衡 | 中性日常姿态 |
| Deep Dialogue | 轻量 | 低 | 连续性、概念友好 |
| Decision | 按需 | 中等 | 决策支持、权衡 |
| Research | 积极 | 高 | 证据密集、文档中心 |

## 操作员边界

单用户系统。单 Enso profile 内的操作员是可信的。不设计为敌对多租户边界。

## 行为契约详细规则

完整行为契约在 `docs/spec/` 下的模块 spec 文件中：
- `brain.md` - 执行流程
- `permission.md` - 权限模型
- `context.md` - 知识/检索/状态
- `tools.md` - 工具编排
- `ui.md` - UI 交互
- `audit.md` - 审计事件
