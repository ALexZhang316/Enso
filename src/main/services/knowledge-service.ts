import fs from "node:fs";
import path from "node:path";
import { KnowledgeSource, RetrievedSnippet } from "../../shared/types";
import { hasChinese, segmentTerms } from "./segmenter";
import { EnsoStore } from "./store";

// ---------- 停用词 ----------

// 中文常见停用词（的、了、是、在……），过滤后让检索聚焦于实义词
const ZH_STOPWORDS = new Set([
  "的", "了", "是", "在", "我", "有", "和", "就", "不", "人",
  "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去",
  "你", "会", "着", "没有", "看", "好", "自己", "这", "他", "她",
  "吗", "什么", "那", "里", "怎么", "没", "把", "被", "给", "从",
  "还", "可以", "能", "但", "而", "呢", "吧", "么", "让", "对"
]);

// 英文常见停用词
const EN_STOPWORDS = new Set([
  "the", "is", "at", "in", "on", "of", "and", "or", "to", "for",
  "it", "an", "be", "as", "by", "do", "if", "no", "so", "we",
  "he", "me", "my", "up", "am", "us", "this", "that", "with", "from",
  "how", "what", "when", "where", "which", "who", "can", "will"
]);

// ---------- 查询词提取 ----------

/**
 * 从查询文本中提取检索词。
 * 中文部分用 jieba 分词（通过 segmenter 模块），英文部分用正则按空格/标点拆分。
 * 过滤停用词和过短的 token，最多返回 10 个词。
 */
const extractTerms = (query: string): string[] => {
  const lower = query.toLowerCase();
  const terms: string[] = [];

  if (hasChinese(lower)) {
    // 用 jieba 分词处理整个查询（jieba 对英文也能正确按空格切分）
    const words = segmentTerms(lower);
    for (const word of words) {
      // 跳过纯标点/空白
      if (/^[^a-z0-9\u4e00-\u9fa5]+$/.test(word)) continue;
      if (word.length >= 2 && !ZH_STOPWORDS.has(word) && !EN_STOPWORDS.has(word)) {
        terms.push(word);
      }
    }
  } else {
    // 纯英文/数字：保持原逻辑
    const tokens = lower.split(/[^a-z0-9_]+/);
    for (const token of tokens) {
      const trimmed = token.trim();
      if (trimmed.length >= 2 && !EN_STOPWORDS.has(trimmed)) {
        terms.push(trimmed);
      }
    }
  }

  // 去重并限制数量
  return [...new Set(terms)].slice(0, 10);
};

export class KnowledgeService {
  constructor(private readonly store: EnsoStore) {}

  async ingestFile(filePath: string): Promise<KnowledgeSource> {
    const sourceName = path.basename(filePath);
    const raw = fs.readFileSync(filePath, "utf8");

    const sourceId = this.store.addKnowledgeSource(sourceName, filePath);
    const { RecursiveCharacterTextSplitter } = await import("langchain/text_splitter");

    // Markdown 感知分割：优先在标题、空行、段落边界处切分，
    // 保留语义完整性，避免把一段话切到两个 chunk 里
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 150,
      separators: [
        "\n## ",     // 二级标题
        "\n### ",    // 三级标题
        "\n#### ",   // 四级标题
        "\n\n",      // 空行（段落分隔）
        "\n",        // 单行
        "。",        // 中文句号
        ". ",        // 英文句号
        " "          // 空格（最后兜底）
      ]
    });

    const chunks = await splitter.splitText(raw);

    chunks.forEach((chunk, index) => {
      this.store.insertKnowledgeChunk(sourceId, index, chunk, {
        sourceName,
        chunkIndex: index
      });
    });

    this.store.updateKnowledgeSourceChunkCount(sourceId, chunks.length);

    const source = this.store.listKnowledgeSources().find((item) => item.id === sourceId);
    if (!source) {
      throw new Error("Knowledge source was not persisted.");
    }

    return source;
  }

  retrieve(query: string, limit = 5): RetrievedSnippet[] {
    const terms = extractTerms(query);
    if (terms.length === 0) {
      return [];
    }

    return this.store.searchKnowledgeChunks(query, terms, limit);
  }
}
