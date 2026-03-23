import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_MODE, ModeId } from "../../shared/modes";
import {
  AuditSummary,
  ChatMessage,
  Conversation,
  KnowledgeSource,
  RetrievedSnippet,
  StateSnapshot
} from "../../shared/types";

const now = (): string => new Date().toISOString();

const toConversation = (row: any): Conversation => ({
  id: row.id,
  title: row.title,
  mode: row.mode,
  pinned: Boolean(row.pinned),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toMessage = (row: any): ChatMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role,
  content: row.content,
  metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
  createdAt: row.created_at
});

const toState = (row: any): StateSnapshot => ({
  conversationId: row.conversation_id,
  retrievalUsed: Boolean(row.retrieval_used),
  toolsCalled: row.tools_called_json ? JSON.parse(row.tools_called_json) : [],
  latestToolResult: row.latest_tool_result,
  pendingConfirmation: Boolean(row.pending_confirmation),
  pendingAction: row.pending_action_json ? JSON.parse(row.pending_action_json) : null,
  taskStatus: row.task_status,
  updatedAt: row.updated_at,
  plan: row.plan_json ? JSON.parse(row.plan_json) : null,
  trace: row.trace_json ? JSON.parse(row.trace_json) : [],
  verification: row.verification_json ? JSON.parse(row.verification_json) : null
});

const toAudit = (row: any): AuditSummary => ({
  id: row.id,
  conversationId: row.conversation_id,
  mode: row.mode,
  retrievalUsed: Boolean(row.retrieval_used),
  toolsUsed: row.tools_used_json ? JSON.parse(row.tools_used_json) : [],
  resultType: row.result_type,
  riskNotes: row.risk_notes,
  createdAt: row.created_at
});

const scoreByTerms = (content: string, terms: string[]): number => {
  const lowered = content.toLowerCase();
  return terms.reduce((sum, term) => {
    if (!term) {
      return sum;
    }

    let count = 0;
    let index = lowered.indexOf(term);
    while (index !== -1) {
      count += 1;
      index = lowered.indexOf(term, index + term.length);
    }

    return sum + count;
  }, 0);
};

// 围绕第一个匹配词提取上下文摘录（而不是截取 content 前 N 字符）
// 这样用户看到的 snippet 更贴近实际匹配位置
const extractSnippetAroundMatch = (content: string, terms: string[], maxLen = 600): string => {
  const lowered = content.toLowerCase();
  let earliestPos = -1;

  for (const term of terms) {
    const pos = lowered.indexOf(term);
    if (pos !== -1 && (earliestPos === -1 || pos < earliestPos)) {
      earliestPos = pos;
    }
  }

  if (earliestPos === -1 || content.length <= maxLen) {
    return content.slice(0, maxLen);
  }

  // 在匹配位置前后各留一半窗口
  const halfWindow = Math.floor(maxLen / 2);
  let start = Math.max(0, earliestPos - halfWindow);
  const end = Math.min(content.length, start + maxLen);

  // 如果截取到末尾了，往前补
  if (end === content.length) {
    start = Math.max(0, end - maxLen);
  }

  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return `${prefix}${content.slice(start, end)}${suffix}`;
};

export class EnsoStore {
  private readonly db: Database.Database;
  private knowledgeSearchIndexAvailable = false;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS state_snapshots (
        conversation_id TEXT PRIMARY KEY,
        retrieval_used INTEGER NOT NULL DEFAULT 0,
        tools_called_json TEXT NOT NULL DEFAULT '[]',
        latest_tool_result TEXT NOT NULL DEFAULT '',
        pending_confirmation INTEGER NOT NULL DEFAULT 0,
        pending_action_json TEXT NOT NULL DEFAULT 'null',
        task_status TEXT NOT NULL DEFAULT 'idle',
        updated_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audits (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        retrieval_used INTEGER NOT NULL DEFAULT 0,
        tools_used_json TEXT NOT NULL DEFAULT '[]',
        result_type TEXT NOT NULL,
        risk_notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS knowledge_sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY(source_id) REFERENCES knowledge_sources(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_audits_conversation ON audits(conversation_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON knowledge_chunks(source_id, chunk_index);
    `);

    this.initializeKnowledgeSearchIndex();

    // migrate: add plan/trace/verification columns to state_snapshots
    const stateColumns = this.db.pragma("table_info(state_snapshots)") as Array<{ name: string }>;
    const colNames = new Set(stateColumns.map((c) => c.name));
    if (!colNames.has("plan_json")) {
      this.db.exec("ALTER TABLE state_snapshots ADD COLUMN plan_json TEXT NOT NULL DEFAULT 'null'");
    }
    if (!colNames.has("trace_json")) {
      this.db.exec("ALTER TABLE state_snapshots ADD COLUMN trace_json TEXT NOT NULL DEFAULT '[]'");
    }
    if (!colNames.has("verification_json")) {
      this.db.exec("ALTER TABLE state_snapshots ADD COLUMN verification_json TEXT NOT NULL DEFAULT 'null'");
    }
    if (!colNames.has("pending_action_json")) {
      this.db.exec("ALTER TABLE state_snapshots ADD COLUMN pending_action_json TEXT NOT NULL DEFAULT 'null'");
    }
  }

  private initializeKnowledgeSearchIndex(): void {
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
          chunk_id UNINDEXED,
          source_id UNINDEXED,
          content,
          tokenize = 'unicode61 remove_diacritics 2'
        );
      `);

      this.db.exec(`
        INSERT INTO knowledge_chunks_fts (chunk_id, source_id, content)
        SELECT kc.id, kc.source_id, kc.content
        FROM knowledge_chunks kc
        WHERE NOT EXISTS (
          SELECT 1 FROM knowledge_chunks_fts fts WHERE fts.chunk_id = kc.id
        );
      `);

      this.knowledgeSearchIndexAvailable = true;
    } catch {
      this.knowledgeSearchIndexAvailable = false;
    }
  }

  ensureDefaultConversation(defaultMode: ModeId = DEFAULT_MODE): Conversation {
    const existing = this.listConversations();
    if (existing.length > 0) {
      return existing[0];
    }

    return this.createConversation(defaultMode, "新会话");
  }

  listConversations(): Conversation[] {
    const rows = this.db.prepare("SELECT * FROM conversations ORDER BY pinned DESC, updated_at DESC").all();

    return rows.map(toConversation);
  }

  getConversation(conversationId: string): Conversation | null {
    const row = this.db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
    return row ? toConversation(row) : null;
  }

  createConversation(mode: ModeId = DEFAULT_MODE, title = "新会话"): Conversation {
    const timestamp = now();
    const id = randomUUID();

    this.db
      .prepare("INSERT INTO conversations (id, title, mode, pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)")
      .run(id, title, mode, timestamp, timestamp);

    return this.getConversation(id)!;
  }

  renameConversation(conversationId: string, title: string): void {
    this.db
      .prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?")
      .run(title, now(), conversationId);
  }

  deleteConversation(conversationId: string): void {
    this.db.prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
  }

  togglePinnedConversation(conversationId: string): void {
    this.db
      .prepare("UPDATE conversations SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?")
      .run(now(), conversationId);
  }

  setConversationMode(conversationId: string, mode: ModeId): void {
    this.db.prepare("UPDATE conversations SET mode = ?, updated_at = ? WHERE id = ?").run(mode, now(), conversationId);
  }

  listMessages(conversationId: string): ChatMessage[] {
    const rows = this.db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId);

    return rows.map(toMessage);
  }

  listRecentMessages(conversationId: string, limit = 12): ChatMessage[] {
    const rows = this.db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(conversationId, limit)
      .reverse();

    return rows.map(toMessage);
  }

  addMessage(
    conversationId: string,
    role: ChatMessage["role"],
    content: string,
    metadata: Record<string, unknown> = {}
  ): ChatMessage {
    const id = randomUUID();
    const timestamp = now();

    this.db
      .prepare(
        "INSERT INTO messages (id, conversation_id, role, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(id, conversationId, role, content, JSON.stringify(metadata), timestamp);

    this.db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(timestamp, conversationId);

    const row = this.db.prepare("SELECT * FROM messages WHERE id = ?").get(id);

    return toMessage(row);
  }

  getState(conversationId: string): StateSnapshot {
    const row = this.db.prepare("SELECT * FROM state_snapshots WHERE conversation_id = ?").get(conversationId);

    if (!row) {
      return {
        conversationId,
        retrievalUsed: false,
        toolsCalled: [],
        latestToolResult: "",
        pendingConfirmation: false,
        pendingAction: null,
        taskStatus: "idle",
        updatedAt: now(),
        plan: null,
        trace: [],
        verification: null
      };
    }

    return toState(row);
  }

  upsertState(state: StateSnapshot): StateSnapshot {
    const timestamp = now();

    this.db
      .prepare(
        `
          INSERT INTO state_snapshots (
            conversation_id,
            retrieval_used,
            tools_called_json,
            latest_tool_result,
            pending_confirmation,
            pending_action_json,
            task_status,
            updated_at,
            plan_json,
            trace_json,
            verification_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(conversation_id)
          DO UPDATE SET
            retrieval_used = excluded.retrieval_used,
            tools_called_json = excluded.tools_called_json,
            latest_tool_result = excluded.latest_tool_result,
            pending_confirmation = excluded.pending_confirmation,
            pending_action_json = excluded.pending_action_json,
            task_status = excluded.task_status,
            updated_at = excluded.updated_at,
            plan_json = excluded.plan_json,
            trace_json = excluded.trace_json,
            verification_json = excluded.verification_json
        `
      )
      .run(
        state.conversationId,
        state.retrievalUsed ? 1 : 0,
        JSON.stringify(state.toolsCalled),
        state.latestToolResult,
        state.pendingConfirmation ? 1 : 0,
        JSON.stringify(state.pendingAction ?? null),
        state.taskStatus,
        timestamp,
        JSON.stringify(state.plan ?? null),
        JSON.stringify(state.trace ?? []),
        JSON.stringify(state.verification ?? null)
      );

    return this.getState(state.conversationId);
  }

  resolvePendingConfirmation(conversationId: string): StateSnapshot {
    const current = this.getState(conversationId);
    return this.upsertState({
      ...current,
      pendingConfirmation: false,
      pendingAction: null,
      taskStatus: "completed",
      updatedAt: now(),
      plan: current.plan,
      trace: current.trace,
      verification: current.verification
    });
  }

  getLatestAudit(conversationId: string): AuditSummary | null {
    const row = this.db
      .prepare("SELECT * FROM audits WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(conversationId);

    return row ? toAudit(row) : null;
  }

  listAudits(limit = 80): AuditSummary[] {
    const rows = this.db.prepare("SELECT * FROM audits ORDER BY created_at DESC LIMIT ?").all(Math.max(1, limit));

    return rows.map(toAudit);
  }

  listAuditsByConversation(conversationId: string, limit = 80): AuditSummary[] {
    const rows = this.db
      .prepare("SELECT * FROM audits WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(conversationId, Math.max(1, limit));

    return rows.map(toAudit);
  }

  addAudit(params: {
    conversationId: string;
    mode: ModeId;
    retrievalUsed: boolean;
    toolsUsed: string[];
    resultType: AuditSummary["resultType"];
    riskNotes: string;
  }): AuditSummary {
    const id = randomUUID();
    const timestamp = now();

    this.db
      .prepare(
        `
          INSERT INTO audits (
            id,
            conversation_id,
            mode,
            retrieval_used,
            tools_used_json,
            result_type,
            risk_notes,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        id,
        params.conversationId,
        params.mode,
        params.retrievalUsed ? 1 : 0,
        JSON.stringify(params.toolsUsed),
        params.resultType,
        params.riskNotes,
        timestamp
      );

    return this.getLatestAudit(params.conversationId)!;
  }

  setActiveConversationId(conversationId: string): void {
    this.db
      .prepare(
        `
          INSERT INTO app_state (key, value_json) VALUES ('active_conversation_id', ?)
          ON CONFLICT(key)
          DO UPDATE SET value_json = excluded.value_json
        `
      )
      .run(JSON.stringify({ conversationId }));
  }

  getActiveConversationId(): string | null {
    const row = this.db.prepare("SELECT value_json FROM app_state WHERE key = 'active_conversation_id'").get() as
      | { value_json: string }
      | undefined;

    if (!row) {
      return null;
    }

    const parsed = JSON.parse(row.value_json) as { conversationId?: string };
    return parsed.conversationId ?? null;
  }

  listKnowledgeSources(): KnowledgeSource[] {
    const rows = this.db.prepare("SELECT * FROM knowledge_sources ORDER BY created_at DESC").all();

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      path: row.path,
      chunkCount: row.chunk_count,
      createdAt: row.created_at
    }));
  }

  addKnowledgeSource(name: string, sourcePath: string): string {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO knowledge_sources (id, name, path, chunk_count, created_at) VALUES (?, ?, ?, 0, ?)")
      .run(id, name, sourcePath, now());

    return id;
  }

  updateKnowledgeSourceChunkCount(sourceId: string, chunkCount: number): void {
    this.db.prepare("UPDATE knowledge_sources SET chunk_count = ? WHERE id = ?").run(chunkCount, sourceId);
  }

  insertKnowledgeChunk(
    sourceId: string,
    chunkIndex: number,
    content: string,
    metadata: Record<string, unknown> = {}
  ): void {
    const chunkId = randomUUID();

    this.db
      .prepare(
        "INSERT INTO knowledge_chunks (id, source_id, chunk_index, content, metadata_json) VALUES (?, ?, ?, ?, ?)"
      )
      .run(chunkId, sourceId, chunkIndex, content, JSON.stringify(metadata));

    if (this.knowledgeSearchIndexAvailable) {
      this.db
        .prepare("INSERT INTO knowledge_chunks_fts (chunk_id, source_id, content) VALUES (?, ?, ?)")
        .run(chunkId, sourceId, content);
    }
  }

  private searchKnowledgeChunksByLike(query: string, terms: string[], limit = 6): RetrievedSnippet[] {
    const params: Record<string, string | number> = { limit: Math.max(1, limit * 4) };
    const clauses = terms.map((term, index) => {
      const key = `term${index}`;
      params[key] = `%${term}%`;
      return `kc.content LIKE @${key}`;
    });
    const loweredQuery = query.trim().toLowerCase();

    const rows = this.db
      .prepare(
        `
          SELECT
            kc.id AS chunk_id,
            kc.source_id AS source_id,
            ks.name AS source_name,
            ks.path AS source_path,
            kc.content AS content
          FROM knowledge_chunks kc
          JOIN knowledge_sources ks ON ks.id = kc.source_id
          WHERE ${clauses.join(" OR ")}
          LIMIT @limit
        `
      )
      .all(params);

    return rows
      .map((row: any) => {
        const loweredContent = row.content.toLowerCase();
        const phraseBoost = loweredQuery.length >= 4 && loweredContent.includes(loweredQuery) ? 50 : 0;
        const matchedDistinctTerms = terms.filter((term) => loweredContent.includes(term)).length;
        const score = phraseBoost + matchedDistinctTerms * 10 + scoreByTerms(row.content, terms);
        return {
          chunkId: row.chunk_id,
          sourceId: row.source_id,
          sourceName: row.source_name,
          sourcePath: row.source_path,
          content: extractSnippetAroundMatch(row.content, terms),
          score
        } satisfies RetrievedSnippet;
      })
      .sort((a: RetrievedSnippet, b: RetrievedSnippet) => b.score - a.score)
      .slice(0, limit);
  }

  private searchKnowledgeChunksByFts(query: string, terms: string[], limit = 6): RetrievedSnippet[] {
    if (!this.knowledgeSearchIndexAvailable) {
      return [];
    }

    const normalizedPhrase = terms.join(" ").trim();
    const exactPhraseQuery = normalizedPhrase.includes(" ") ? `"${normalizedPhrase}"` : "";
    const termQuery = terms.map((term) => `"${term}"`).join(" OR ");
    const matchQuery = [exactPhraseQuery, termQuery].filter(Boolean).join(" OR ");
    const params = {
      matchQuery,
      limit: Math.max(1, limit * 8)
    };
    const loweredQuery = query.trim().toLowerCase();

    const rows = this.db
      .prepare(
        `
          SELECT
            kc.id AS chunk_id,
            kc.source_id AS source_id,
            ks.name AS source_name,
            ks.path AS source_path,
            kc.content AS content,
            bm25(knowledge_chunks_fts) AS bm25_score
          FROM knowledge_chunks_fts
          JOIN knowledge_chunks kc ON kc.id = knowledge_chunks_fts.chunk_id
          JOIN knowledge_sources ks ON ks.id = kc.source_id
          WHERE knowledge_chunks_fts MATCH @matchQuery
          ORDER BY bm25_score ASC
          LIMIT @limit
        `
      )
      .all(params);

    return rows
      .map((row: any) => {
        const loweredContent = row.content.toLowerCase();
        const termScore = scoreByTerms(row.content, terms);
        const matchedDistinctTerms = terms.filter((term) => loweredContent.includes(term)).length;
        const phraseBoost = loweredQuery.length >= 4 && loweredContent.includes(loweredQuery) ? 50 : 0;
        const bm25Score = typeof row.bm25_score === "number" ? -row.bm25_score : 0;

        return {
          chunkId: row.chunk_id,
          sourceId: row.source_id,
          sourceName: row.source_name,
          sourcePath: row.source_path,
          content: extractSnippetAroundMatch(row.content, terms),
          score: phraseBoost + matchedDistinctTerms * 10 + termScore + bm25Score
        } satisfies RetrievedSnippet;
      })
      .sort((a: RetrievedSnippet, b: RetrievedSnippet) => b.score - a.score)
      .slice(0, limit);
  }

  searchKnowledgeChunks(query: string, terms: string[], limit = 6): RetrievedSnippet[] {
    const normalizedTerms = terms
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length >= 2)
      .slice(0, 6);

    if (normalizedTerms.length === 0) {
      return [];
    }

    const ftsResults = this.searchKnowledgeChunksByFts(query, normalizedTerms, limit);
    if (ftsResults.length > 0) {
      return ftsResults;
    }

    return this.searchKnowledgeChunksByLike(query, normalizedTerms, limit);
  }

  close(): void {
    if (this.db.open) {
      this.db.close();
    }
  }
}
