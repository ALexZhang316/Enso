import fs from "node:fs";
import path from "node:path";
import { KnowledgeSource, RetrievedSnippet } from "../../shared/types";
import { EnsoStore } from "./store";

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

const extractTerms = (query: string): string[] =>
  query
    .toLowerCase()
    .split(/[^a-z0-9_\u4e00-\u9fa5]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !ZH_STOPWORDS.has(term) && !EN_STOPWORDS.has(term))
    .slice(0, 10);

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
