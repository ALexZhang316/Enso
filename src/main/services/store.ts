// Enso v2 数据存储层
// 只保留 conversations + messages + app_state
// 删除了审计、知识库、状态快照等旧表

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BoardId, DEFAULT_BOARD } from "../../shared/boards";
import { ChatMessage, Conversation, MessageRole } from "../../shared/types";

const now = (): string => new Date().toISOString();

const toConversation = (row: any): Conversation => ({
  id: row.id,
  board: row.board,
  title: row.title,
  pinned: Boolean(row.pinned),
  model: row.model || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toMessage = (row: any): ChatMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role as MessageRole,
  content: row.content,
  toolName: row.tool_name || undefined,
  createdAt: row.created_at
});

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
        board TEXT NOT NULL,
        title TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        model TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_name TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
    `);

    // 从旧 schema 迁移：如果存在 mode 列但没有 board 列，重命名
    const cols = this.db.pragma("table_info(conversations)") as Array<{ name: string }>;
    const colNames = new Set(cols.map((c) => c.name));
    if (colNames.has("mode") && !colNames.has("board")) {
      this.db.exec("ALTER TABLE conversations RENAME COLUMN mode TO board");
    }
    if (!colNames.has("model")) {
      this.db.exec("ALTER TABLE conversations ADD COLUMN model TEXT NOT NULL DEFAULT ''");
    }

    // messages 表：补充 tool_name 列（旧数据库可能没有）
    const msgCols = this.db.pragma("table_info(messages)") as Array<{ name: string }>;
    const msgColNames = new Set(msgCols.map((c) => c.name));
    if (!msgColNames.has("tool_name")) {
      this.db.exec("ALTER TABLE messages ADD COLUMN tool_name TEXT");
    }
  }

  // ---- 会话 CRUD ----

  listConversations(board?: BoardId): Conversation[] {
    if (board) {
      return this.db
        .prepare("SELECT * FROM conversations WHERE board = ? ORDER BY pinned DESC, updated_at DESC")
        .all(board)
        .map(toConversation);
    }
    return this.db
      .prepare("SELECT * FROM conversations ORDER BY pinned DESC, updated_at DESC")
      .all()
      .map(toConversation);
  }

  getConversation(id: string): Conversation | null {
    const row = this.db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
    return row ? toConversation(row) : null;
  }

  createConversation(board: BoardId = DEFAULT_BOARD, title = "新会话"): Conversation {
    const id = randomUUID();
    const timestamp = now();
    this.db
      .prepare(
        "INSERT INTO conversations (id, board, title, pinned, model, created_at, updated_at) VALUES (?, ?, ?, 0, '', ?, ?)"
      )
      .run(id, board, title, timestamp, timestamp);
    return this.getConversation(id)!;
  }

  renameConversation(id: string, title: string): void {
    this.db.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?").run(title, now(), id);
  }

  deleteConversation(id: string): void {
    this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  }

  togglePinned(id: string): void {
    this.db
      .prepare("UPDATE conversations SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?")
      .run(now(), id);
  }

  updateConversationModel(id: string, model: string): void {
    this.db.prepare("UPDATE conversations SET model = ?, updated_at = ? WHERE id = ?").run(model, now(), id);
  }

  ensureDefaultConversation(board: BoardId = DEFAULT_BOARD): Conversation {
    const existing = this.listConversations(board);
    if (existing.length > 0) return existing[0];
    return this.createConversation(board, "新会话");
  }

  // ---- 消息 CRUD ----

  listMessages(conversationId: string): ChatMessage[] {
    return this.db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId)
      .map(toMessage);
  }

  listRecentMessages(conversationId: string, limit = 48): ChatMessage[] {
    return this.db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(conversationId, limit)
      .reverse()
      .map(toMessage);
  }

  addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    toolName?: string
  ): ChatMessage {
    const id = randomUUID();
    const timestamp = now();
    this.db
      .prepare(
        "INSERT INTO messages (id, conversation_id, role, content, tool_name, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(id, conversationId, role, content, toolName ?? null, timestamp);
    this.db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(timestamp, conversationId);
    return toMessage(this.db.prepare("SELECT * FROM messages WHERE id = ?").get(id));
  }

  // ---- 应用状态 ----

  setActiveConversationId(conversationId: string): void {
    this.db
      .prepare(
        `INSERT INTO app_state (key, value_json) VALUES ('active_conversation_id', ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`
      )
      .run(JSON.stringify({ conversationId }));
  }

  getActiveConversationId(): string | null {
    const row = this.db.prepare("SELECT value_json FROM app_state WHERE key = 'active_conversation_id'").get() as
      | { value_json: string }
      | undefined;
    if (!row) return null;
    const parsed = JSON.parse(row.value_json) as { conversationId?: string };
    return parsed.conversationId ?? null;
  }

  close(): void {
    if (this.db.open) this.db.close();
  }
}
