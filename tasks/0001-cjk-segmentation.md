# Task 0001: CJK 中文分词提升检索质量

## Status
ready

## Ownership
- Decision owner: Alex
- Spec / review owner: Claude (Opus)
- Implementation / integration owner: Codex

## Objective

引入 jieba 中文分词，替换当前正则拆分 + FTS5 单字切分的方案，让中文检索能按词粒度匹配而非字符粒度。改动涉及两个层面：查询端（extractTerms）和索引端（FTS5 入库时预分词）。

### 问题分析

当前检索对中文的处理有两个断裂点：

1. **查询端**：`extractTerms` 用正则 `[^a-z0-9_\u4e00-\u9fa5]+` 拆分，连续中文字符被当作一个整体 token。用户输入"人工智能技术"会得到一个 token `"人工智能技术"`，而不是 `["人工智能", "技术"]`。这意味着只有完全包含整个字符串的 chunk 才能命中。

2. **索引端**：FTS5 使用 `unicode61` tokenizer，对中文按单字拆分（"人"、"工"、"智"、"能"）。查询端传入的长 token 无法匹配单字索引，导致 FTS 层几乎无法命中中文内容，退化到 LIKE 回退。

**解决思路**：在入库和查询两端都用 jieba 分词，FTS5 存储和查询的都是分好词的文本（词之间空格分隔），让 `unicode61` 按空格切分即可正确工作。

## Acceptance criteria

- [ ] 安装 `@node-rs/jieba`（Rust 原生绑定，无需手动管理词典文件，Electron 兼容）
- [ ] `knowledge-service.ts` 新增 `segmentChinese(text: string): string` 函数，对文本中的中文部分调用 jieba 分词，词间插入空格，英文部分保持不变
- [ ] `extractTerms` 改用 jieba 分词提取中文词，而非正则整块切分；保留停用词过滤；英文词提取逻辑不变
- [ ] `store.ts` 的 `insertKnowledgeChunk` 在写入 FTS5 表时，对 content 做 jieba 预分词后再插入（原始 content 在主表 `knowledge_chunks` 中保持不变）
- [ ] 已有知识源重新导入时，FTS5 索引使用分词后的文本（ingestFile 流程自动处理）
- [ ] 检索评分逻辑（BM25 + 短语加权 + term 计数）无需大改，因为分词后 FTS5 自然能按词匹配
- [ ] 新增集成测试：中文多词查询（如"人工智能"）能命中包含该词的 chunk，且排名高于仅包含单字的 chunk
- [ ] 新增集成测试：中英混合查询正常工作
- [ ] `npm run build && npm run test:all` 通过
- [ ] 无回归：现有英文检索测试继续通过

## Verification plan

- `npm run build` 成功
- `npm run test:all` 全部通过（单元 + 集成 + UI）
- 集成测试证明：
  - 中文查询 "人工智能" 能命中含 "人工智能技术发展" 的 chunk
  - 中文查询 "机器学习" 不会命中只含 "机器" 或 "学习" 但不含 "机器学习" 的 chunk（或至少排分更低）
  - 英文查询行为不变

## Files in scope

| 文件 | 改动 |
|------|------|
| `package.json` | 添加 `@node-rs/jieba` 依赖 |
| `src/main/services/knowledge-service.ts` | 新增 `segmentChinese`，重写 `extractTerms` |
| `src/main/services/store.ts` | `insertKnowledgeChunk` 写 FTS 时预分词 |
| `tests/integration.test.cjs` | 新增中文分词检索测试 |
| `docs/spec/context.md` | 更新检索管线描述 |
| `docs/codebase-contract.md` | 更新依赖列表 |
| `CHANGELOG.md` | 记录改动 |
| `TODO_LIMITATIONS.md` | 移除 jieba 待办项 |

## Files out of scope

- FTS5 tokenizer 本身不更换（仍用 `unicode61`，靠预分词插入空格实现词级索引）
- 嵌入/向量检索（仍然 deferred）
- 模型驱动的工具选择
- UI 层无改动

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

- `@node-rs/jieba` 选型理由：纯 Rust 编译为 Node.js native addon，无需手动下载词典，性能好，prebuild 支持 Windows/macOS/Linux，Electron rebuild 兼容。备选 `nodejieba`（C++ 绑定）如果 Rust 工具链有问题。
- 预分词方案是 SQLite FTS5 + CJK 的标准做法：在索引和查询两端都做分词，让 FTS5 的空格分词器自然工作。不需要自定义 tokenizer 插件。
- 分词粒度用 jieba 默认的精确模式（cut），不用全模式或搜索引擎模式，避免过度分词产生噪音。
