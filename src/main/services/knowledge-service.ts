import fs from "node:fs";
import path from "node:path";
import { KnowledgeSource, RetrievedSnippet } from "../../shared/types";
import { EnsoStore } from "./store";

const extractTerms = (query: string): string[] =>
  query
    .toLowerCase()
    .split(/[^a-z0-9_\u4e00-\u9fa5]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 8);

export class KnowledgeService {
  constructor(private readonly store: EnsoStore) {}

  async ingestFile(filePath: string): Promise<KnowledgeSource> {
    const sourceName = path.basename(filePath);
    const raw = fs.readFileSync(filePath, "utf8");

    const sourceId = this.store.addKnowledgeSource(sourceName, filePath);
    const { RecursiveCharacterTextSplitter } = await import("langchain/text_splitter");

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 700,
      chunkOverlap: 120
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

    return this.store.searchKnowledgeChunks(terms, limit);
  }
}

