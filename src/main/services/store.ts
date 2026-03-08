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
  taskStatus: row.task_status,
  updatedAt: row.updated_at
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

export class EnsoStore {
  private readonly db: Database.Database;

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
  }

  ensureDefaultConversation(): Conversation {
    const existing = this.listConversations();
    if (existing.length > 0) {
      return existing[0];
    }

    return this.createConversation(DEFAULT_MODE, "新会话");
  }

  listConversations(): Conversation[] {
    const rows = this.db
      .prepare("SELECT * FROM conversations ORDER BY pinned DESC, updated_at DESC")
      .all();

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
      .prepare(
        "INSERT INTO conversations (id, title, mode, pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)"
      )
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
      .prepare(
        "UPDATE conversations SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?"
      )
      .run(now(), conversationId);
  }

  setConversationMode(conversationId: string, mode: ModeId): void {
    this.db
      .prepare("UPDATE conversations SET mode = ?, updated_at = ? WHERE id = ?")
      .run(mode, now(), conversationId);
  }

  listMessages(conversationId: string): ChatMessage[] {
    const rows = this.db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId);

    return rows.map(toMessage);
  }

  listRecentMessages(conversationId: string, limit = 12): ChatMessage[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?"
      )
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

    this.db
      .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
      .run(timestamp, conversationId);

    const row = this.db.prepare("SELECT * FROM messages WHERE id = ?").get(id);

    return toMessage(row);
  }

  getState(conversationId: string): StateSnapshot {
    const row = this.db
      .prepare("SELECT * FROM state_snapshots WHERE conversation_id = ?")
      .get(conversationId);

    if (!row) {
      return {
        conversationId,
        retrievalUsed: false,
        toolsCalled: [],
        latestToolResult: "",
        pendingConfirmation: false,
        taskStatus: "idle",
        updatedAt: now()
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
            task_status,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(conversation_id)
          DO UPDATE SET
            retrieval_used = excluded.retrieval_used,
            tools_called_json = excluded.tools_called_json,
            latest_tool_result = excluded.latest_tool_result,
            pending_confirmation = excluded.pending_confirmation,
            task_status = excluded.task_status,
            updated_at = excluded.updated_at
        `
      )
      .run(
        state.conversationId,
        state.retrievalUsed ? 1 : 0,
        JSON.stringify(state.toolsCalled),
        state.latestToolResult,
        state.pendingConfirmation ? 1 : 0,
        state.taskStatus,
        timestamp
      );

    return this.getState(state.conversationId);
  }

  resolvePendingConfirmation(conversationId: string): StateSnapshot {
    const current = this.getState(conversationId);
    return this.upsertState({
      ...current,
      pendingConfirmation: false,
      taskStatus: "completed",
      updatedAt: now()
    });
  }

  getLatestAudit(conversationId: string): AuditSummary | null {
    const row = this.db
      .prepare("SELECT * FROM audits WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(conversationId);

    return row ? toAudit(row) : null;
  }

  listAudits(limit = 80): AuditSummary[] {
    const rows = this.db
      .prepare("SELECT * FROM audits ORDER BY created_at DESC LIMIT ?")
      .all(Math.max(1, limit));

    return rows.map(toAudit);
  }

  listAuditsByConversation(conversationId: string, limit = 80): AuditSummary[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM audits WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?"
      )
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
    const row = this.db
      .prepare("SELECT value_json FROM app_state WHERE key = 'active_conversation_id'")
      .get() as { value_json: string } | undefined;

    if (!row) {
      return null;
    }

    const parsed = JSON.parse(row.value_json) as { conversationId?: string };
    return parsed.conversationId ?? null;
  }

  listKnowledgeSources(): KnowledgeSource[] {
    const rows = this.db
      .prepare("SELECT * FROM knowledge_sources ORDER BY created_at DESC")
      .all();

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
      .prepare(
        "INSERT INTO knowledge_sources (id, name, path, chunk_count, created_at) VALUES (?, ?, ?, 0, ?)"
      )
      .run(id, name, sourcePath, now());

    return id;
  }

  updateKnowledgeSourceChunkCount(sourceId: string, chunkCount: number): void {
    this.db
      .prepare("UPDATE knowledge_sources SET chunk_count = ? WHERE id = ?")
      .run(chunkCount, sourceId);
  }

  insertKnowledgeChunk(
    sourceId: string,
    chunkIndex: number,
    content: string,
    metadata: Record<string, unknown> = {}
  ): void {
    this.db
      .prepare(
        "INSERT INTO knowledge_chunks (id, source_id, chunk_index, content, metadata_json) VALUES (?, ?, ?, ?, ?)"
      )
      .run(randomUUID(), sourceId, chunkIndex, content, JSON.stringify(metadata));
  }

  searchKnowledgeChunks(terms: string[], limit = 6): RetrievedSnippet[] {
    const normalizedTerms = terms
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length >= 2)
      .slice(0, 6);

    if (normalizedTerms.length === 0) {
      return [];
    }

    const params: Record<string, string | number> = { limit: Math.max(1, limit * 4) };
    const clauses = normalizedTerms.map((term, index) => {
      const key = `term${index}`;
      params[key] = `%${term}%`;
      return `kc.content LIKE @${key}`;
    });

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
        const score = scoreByTerms(row.content, normalizedTerms);
        return {
          chunkId: row.chunk_id,
          sourceId: row.source_id,
          sourceName: row.source_name,
          sourcePath: row.source_path,
          content: row.content.slice(0, 600),
          score
        } satisfies RetrievedSnippet;
      })
      .sort((a: RetrievedSnippet, b: RetrievedSnippet) => b.score - a.score)
      .slice(0, limit);
  }

  close(): void {
    if (this.db.open) {
      this.db.close();
    }
  }
}


