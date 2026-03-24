# TODO / LIMITATIONS

## Current Limitations (v2)

- 工具调用尚未实现：decision 板块的网络搜索、research 板块的学术检索都还是空壳。当前三个板块都是纯对话。
- 投资组合跟踪表（portfolio tracking）尚未创建对应的 SQLite 表和 UI。
- 无打包/安装程序。开发阶段通过 `npm run dev` 或 Electron 启动。
- 提供商后端（OpenAI、Anthropic、Google、Kimi）已接入 Vercel AI SDK，但没有针对真实 API 的自动化端到端测试。
- 旧 SQLite 数据库会在首次加载时自动迁移 `mode` 列为 `board`，但迁移路径只做了基本验证。
- 浏览器预览模式（`VITE_ENABLE_BROWSER_MOCK=true`）使用静态 mock 数据，不支持真实的流式交互。

## Completed (v1 → v2 Migration)

- 移除 LangChain，替换为 Vercel AI SDK（`ai`、`@ai-sdk/openai`、`@ai-sdk/anthropic`、`@ai-sdk/google`）
- 移除执行流水线（规划器、执行引擎、验证器、门控检查）
- 移除知识库 / RAG 系统
- 移除审计系统
- 移除权限门控和确认/拒绝流程
- 移除 Default 模式，改为三板块隔离架构
- 移除 DeepSeek 提供商
- 移除工作区系统、状态快照系统
- 重写所有文档以反映 v2 架构

## Deferred

- 网络搜索工具（decision 板块）
- 学术文献检索工具（research 板块）
- 投资组合跟踪（手动输入方式）
- 模型驱动的工具选择（让模型决定何时调用什么工具）
- 自动化端到端测试
- 打包和分发

## Near-Term Next Targets

- 实现 decision 板块的网络搜索能力
- 实现 research 板块的学术检索能力
- 创建 portfolio SQLite 表和基础 UI
- 添加对提供商 API 的基本连通性测试
