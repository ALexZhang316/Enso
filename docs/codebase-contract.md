# Codebase Contract v0.3.1

## 本文件的作用

产品文档描述"Enso 应该是什么"。
本文件描述"代码现在实际长什么样"。

本仓库内的文档已经内化为唯一权威来源。
接手时不要依赖任何外部 handoff zip。

每次一个 AI 模型完成一轮开发后，必须更新本文件。
下一个接手的模型在动手写代码之前，必须先按仓库内 onboarding 顺序读共享文档，再回到本文件核对代码现状。

如果本文件与实际代码不一致，以实际代码为准，但接手模型应先修正本文件再继续开发。

---

## 文档优先级（当前唯一权威来源）

发生冲突时，按以下顺序取舍：

1. `docs/current-baseline.md`
2. `docs/execution-flow.md`
3. `docs/windows-product-spec.md`
4. `docs/architecture.md`
5. `docs/module-spec-table.md`
6. `docs/ui-layout.md`
7. `docs/iteration-guidance.md`
8. `docs/revision-notes-2026-03-09.md`
9. `docs/openclaw-reference-notes.md`

---

## 运行与 Git 初始化

环境补齐、原生依赖重建、项目验收，以及缺少 `.git` 时的 GitHub 初始化步骤，统一见：

- `docs/environment-and-github-bootstrap.md`

---

## 文本编码约定

- 仓库文本文件统一使用 UTF-8。
- 在 Windows PowerShell 中进行文档编辑、diff 审阅或复制终端输出前，先执行 `. .\scripts\enable-utf8-terminal.ps1`。
- 文档里优先使用 ASCII 标点的等价写法，例如用 `->` 代替 Unicode 箭头。

---

## 目录结构（每轮更新）

在下方填写当前实际的目录树。不要写计划中的结构，只写已经存在的文件。

```
（由最近一轮完成开发的模型填写）
```

---

## 模块边界登记表

每个已实现的模块填写一行。未实现的不要写。

| 模块名 | 主文件路径 | 对外暴露的函数/类 | 依赖哪些其他模块 | 当前状态 |
|--------|-----------|------------------|----------------|---------|
| （示例）Planner | src/core/planner.ts | createPlan(), refinePlan() | RequestParser, StateLayer | 可运行，未集成 |

---

## 命名约定（一旦确定不要改）

以下约定由搭框架的第一轮开发确定，后续所有模型必须遵守：

- 文件命名风格：（如 kebab-case / camelCase / PascalCase）
- 导出风格：（如 named exports / default exports）
- 组件命名：（如 PascalCase 的 React 组件）
- 数据库表名风格：（如 snake_case）
- 配置键名风格：（如 TOML 中的 kebab-case）

---

## 数据流约定

描述模块之间传递数据的方式。回答以下问题：

1. 模块之间通过什么方式通信？（直接函数调用 / 事件总线 / 消息队列 / 其他）
2. 前端和后端（main process vs renderer process）之间用什么通信？（Electron IPC 的具体 channel 名称）
3. 状态管理用什么方案？（React Context / Zustand / Redux / 其他）
4. 数据库访问是集中在一个模块还是各模块各自访问？

---

## 数据库 Schema（每轮更新）

列出当前 SQLite 中已存在的所有表，包括字段名和类型。

```sql
（由最近一轮完成开发的模型填写）
```

---

## 已做的关键实现决策

记录那些"两种做法都行，但我们选了其中一种"的决定。后续模型不要推翻这些决策，除非有明确指令。

| 决策内容 | 选择了什么 | 为什么 | 哪一轮做的决定 |
|---------|-----------|-------|-------------|
| 模式系统默认态 | 保留独立 `default` 模式，不再用 `deep-dialogue` 兼任默认值 | 对齐产品硬约束，避免“默认模式”和“深度对话模式”语义混淆 | Codex 本轮 |
| OpenClaw 借鉴范围 | 借鉴执行骨架与权限边界，不借鉴产品外形 | 保持 Enso 是本地单用户执行工作台 | Codex 本轮 |
| 高权限动作当前策略 | 先输出 proposal / blocked result，不执行真实 host exec | 先补齐可见主链与验证，再扩执行能力 | Codex 本轮 |

---

## 当前已知问题和 TODO

| 问题描述 | 严重程度 | 属于哪个模块 | 哪一轮发现的 |
|---------|---------|------------|------------|
| `ExecutionFlow` 仍是 MVP 骨架，尚未把 retrieval / tool / verifier 真正串入主链 | 高 | ExecutionFlow | Codex 本轮 |
| retrieval / tool service 尚未真正接入主执行流 | 高 | ExecutionFlow / Tool / Knowledge | Codex 本轮 |
| 右栏仍缺少文档要求的显式 current plan / execution trace / verification 结果视图 | 中 | Renderer UI | Codex 本轮 |
| 高权限动作仍只有门控拦截，没有完整 proposal-to-execution 安全链 | 中 | IPC / Permission Gate | Codex 本轮 |

---

## 交接检查清单

每次从一个模型切换到另一个模型时，交出方必须确认以下事项：

- [ ] 本文件已更新至最新状态
- [ ] 目录结构部分与实际文件一致
- [ ] 模块边界登记表已补充新增模块
- [ ] 数据库 Schema 部分与实际表结构一致
- [ ] 已知问题和 TODO 部分已更新
- [ ] 应用可以正常启动（npm start 或等效命令无报错）
- [ ] 本轮新增的关键实现决策已记录

---

## 接手方首要动作

接手的模型在写任何代码之前，必须先做以下事情：

1. 读 `AGENTS.md`
2. 读 `docs/current-baseline.md`
3. 读 `docs/execution-flow.md`
4. 回到本文件，确认当前代码约定和实际代码是否一致
5. 读 `docs/environment-and-github-bootstrap.md`
6. 如当前客户端会读取 `CLAUDE.md`，再读 `CLAUDE.md`
7. 运行项目，确认能启动
8. 用一句话向用户总结自己对当前代码状态的理解，等用户确认后再动手
