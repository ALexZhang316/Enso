// Enso v2 类型定义 — 极简版
// 删除了审计、门控、验证、执行计划、状态快照等旧类型

import { BoardId } from "./boards";
import { ProviderId } from "./providers";

// ---- 对话 ----

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Conversation {
  id: string;
  board: BoardId;
  title: string;
  pinned: boolean;
  model: string; // 该会话最后使用的模型 ID
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  toolName?: string; // role="tool" 时记录工具名
  createdAt: string;
}

// ---- 配置 ----

export interface ProviderConfig {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string; // 仅用于传输，不持久化到 config.toml
}

export interface EnsoConfig {
  providers: Record<ProviderId, ProviderConfig>;
  activeProvider: ProviderId;
}

// ---- 初始化 ----

export interface InitializationPayload {
  config: EnsoConfig;
  conversations: Conversation[];
  activeConversationId: string;
  messages: ChatMessage[];
}

// ---- 流式响应 ----

export interface StreamChunk {
  conversationId: string;
  delta: string; // 增量文本
}

export interface StreamEnd {
  conversationId: string;
  fullText: string;
  messageId: string;
}

export interface StreamError {
  conversationId: string;
  error: string;
}
