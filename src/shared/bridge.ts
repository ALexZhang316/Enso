// Enso v2 IPC 桥接合约 — 极简版
// 删除了知识库、审计、确认/拒绝、检索等旧接口

import { BoardId } from "./boards";
import { ProviderId } from "./providers";
import { ChatMessage, Conversation, EnsoConfig, InitializationPayload } from "./types";

export interface ConversationViewPayload {
  activeConversationId: string;
  messages: ChatMessage[];
}

export interface ConversationsPayload extends ConversationViewPayload {
  conversations: Conversation[];
}

export interface EnsoBridge {
  // 初始化
  initialize: () => Promise<InitializationPayload>;

  // 会话 CRUD
  createConversation: (board: BoardId, title?: string) => Promise<ConversationsPayload>;
  selectConversation: (conversationId: string) => Promise<ConversationViewPayload>;
  renameConversation: (conversationId: string, title: string) => Promise<Conversation[]>;
  deleteConversation: (conversationId: string) => Promise<ConversationsPayload>;
  togglePinConversation: (conversationId: string) => Promise<Conversation[]>;

  // 配置
  getConfig: () => Promise<EnsoConfig>;
  saveConfig: (config: EnsoConfig) => Promise<EnsoConfig>;
  hasProviderApiKey: (providerId: ProviderId) => Promise<boolean>;
  clearProviderApiKey: (providerId: ProviderId) => Promise<boolean>;

  // 聊天（流式通过 IPC 事件推送，不在这里返回）
  sendMessage: (params: {
    conversationId: string;
    board: BoardId;
    text: string;
    providerId: ProviderId;
    model: string;
  }) => Promise<void>;

  // 取消正在进行的流式响应
  cancelStream: (conversationId: string) => Promise<void>;

  // 应用信息
  getAppInfo: () => { name: string; version: string };

  // 监听流式事件（渲染进程注册回调）
  onStreamChunk: (callback: (data: { conversationId: string; delta: string }) => void) => void;
  onStreamEnd: (
    callback: (data: { conversationId: string; fullText: string; messageId: string }) => void
  ) => void;
  onStreamError: (callback: (data: { conversationId: string; error: string }) => void) => void;

  // 清除事件监听
  removeAllStreamListeners: () => void;
}
