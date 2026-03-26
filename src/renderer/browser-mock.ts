/**
 * Enso v2 Browser mock — 浏览器预览用
 * 仅在 Vite dev 且无 Electron preload 时注入
 */
import type { EnsoBridge } from "@shared/bridge";
import { DEFAULT_BOARD } from "@shared/boards";

const CONV_ID = "mock-conv-1";
const NOW = new Date().toISOString();

const mockConfig = {
  providers: {
    openai: { provider: "openai" as const, baseUrl: "https://api.openai.com/v1", model: "gpt-5.4", apiKey: "" },
    anthropic: { provider: "anthropic" as const, baseUrl: "https://api.anthropic.com/v1", model: "claude-opus-4-6", apiKey: "" },
    google: { provider: "google" as const, baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-3.1-pro-preview", apiKey: "" },
    kimi: { provider: "kimi" as const, baseUrl: "https://api.moonshot.cn/v1", model: "kimi-k2.5", apiKey: "" }
  },
  activeProvider: "openai" as const
};

const mockConversation = {
  id: CONV_ID,
  board: DEFAULT_BOARD,
  title: "示例会话",
  pinned: false,
  model: "gpt-5.4",
  createdAt: NOW,
  updatedAt: NOW
};

const mockMessages = [
  { id: "msg-1", conversationId: CONV_ID, role: "user" as const, content: "你好，Enso。", createdAt: NOW },
  { id: "msg-2", conversationId: CONV_ID, role: "assistant" as const, content: "你好，Alex。有什么想聊的？", createdAt: NOW }
];

export const mockBridge: EnsoBridge = {
  initialize: async () => ({
    config: mockConfig,
    conversations: [mockConversation],
    activeConversationId: CONV_ID,
    messages: mockMessages
  }),
  createConversation: async () => ({
    conversations: [mockConversation],
    activeConversationId: CONV_ID,
    messages: []
  }),
  selectConversation: async () => ({
    activeConversationId: CONV_ID,
    messages: mockMessages
  }),
  renameConversation: async () => [mockConversation],
  deleteConversation: async () => ({
    conversations: [mockConversation],
    activeConversationId: CONV_ID,
    messages: mockMessages
  }),
  togglePinConversation: async () => [mockConversation],
  getConfig: async () => mockConfig,
  saveConfig: async () => mockConfig,
  hasProviderApiKey: async () => false,
  clearProviderApiKey: async () => true,
  getConfiguredProviders: async () => [],
  sendMessage: async () => {},
  cancelStream: async () => {},
  getAppInfo: () => ({ name: "Enso", version: "0.2.0-preview" }),
  onStreamChunk: () => {},
  onStreamEnd: () => {},
  onStreamError: () => {},
  onConversationsChanged: () => {},
  removeAllStreamListeners: () => {}
};
