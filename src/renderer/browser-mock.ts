/**
 * Browser-only mock for window.enso.
 * Enables Vite dev preview without Electron's preload layer.
 * Only injected when window.enso is not already defined (i.e. not in Electron).
 */
import type { EnsoBridge } from "@shared/bridge";

const CONV_ID = "mock-conv-1";
const NOW = new Date().toISOString();

const mockConfig = {
  provider: { provider: "kimi" as const, baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k", apiKey: "" },
  expression: { style: "balanced" as const, reducedQuestioning: true, defaultAssumption: "pragmatic" as const, riskLabeling: "balanced-only" as const },
  permissions: { readOnlyDefault: true, requireConfirmationForWrites: true, requireDoubleConfirmationForExternal: true },
  modeDefaults: { defaultMode: "deep-dialogue" as const, retrievalByMode: { "deep-dialogue": false, decision: true, research: true } }
};

const mockConversation = { id: CONV_ID, title: "示例会话", mode: "deep-dialogue" as const, pinned: false, createdAt: NOW, updatedAt: NOW };

const mockMessages = [
  { id: "msg-1", conversationId: CONV_ID, role: "user" as const, content: "你好，帮我分析一下这个问题。", createdAt: NOW },
  { id: "msg-2", conversationId: CONV_ID, role: "assistant" as const, content: "好的，我来帮你分析。这是一个关于**深度对话模式**的演示。\n\n在这个模式下，我会：\n1. 仔细理解你的问题\n2. 提供结构化的分析\n3. 给出可操作的建议\n\n> 所有操作默认为只读，不会执行任何外部副作用。", createdAt: NOW },
  { id: "msg-3", conversationId: CONV_ID, role: "user" as const, content: "如何评估一个决策的风险？", createdAt: NOW },
  { id: "msg-4", conversationId: CONV_ID, role: "assistant" as const, content: "评估决策风险可以从三个维度展开：\n\n**1. 可逆性**\n- 决策是否可以撤回？\n- 撤回的成本有多高？\n\n**2. 影响范围**\n- 受影响的人和系统有多少？\n- 是局部影响还是全局影响？\n\n**3. 时间敏感性**\n- 延迟决策的代价是什么？\n- 信息是否会随时间变化？\n\n```\n风险等级 = 不可逆性 × 影响范围 × 时间压力\n```", createdAt: NOW }
];

const mockState = {
  conversationId: CONV_ID, retrievalUsed: false, toolsCalled: [] as string[],
  latestToolResult: "", pendingConfirmation: false, taskStatus: "idle" as const, updatedAt: NOW
};

const mockAudit = {
  id: "audit-1", conversationId: CONV_ID, mode: "deep-dialogue" as const,
  retrievalUsed: false, toolsUsed: [] as string[], resultType: "answer" as const, riskNotes: "", createdAt: NOW
};

export const mockBridge: EnsoBridge = {
  initialize: async () => ({
    config: mockConfig, conversations: [mockConversation],
    activeConversationId: CONV_ID, messages: mockMessages, state: mockState,
    audit: mockAudit, knowledgeSources: []
  }),
  createConversation: async () => ({
    conversations: [mockConversation], activeConversationId: CONV_ID,
    messages: [], state: mockState, audit: null
  }),
  selectConversation: async () => ({
    activeConversationId: CONV_ID, messages: mockMessages, state: mockState, audit: mockAudit
  }),
  renameConversation: async () => [mockConversation],
  deleteConversation: async () => ({
    conversations: [mockConversation], activeConversationId: CONV_ID,
    messages: mockMessages, state: mockState, audit: mockAudit
  }),
  togglePinConversation: async () => [mockConversation],
  setMode: async () => mockConversation,
  getConfig: async () => mockConfig,
  saveConfig: async () => mockConfig,
  hasProviderApiKey: async () => false,
  clearProviderApiKey: async () => true,
  importKnowledgeFiles: async () => ({ imported: [], skipped: [], knowledgeSources: [] }),
  retrieveKnowledge: async () => [],
  listAudits: async () => [mockAudit],
  resolvePendingConfirmation: async () => ({ messages: mockMessages, state: mockState, audit: mockAudit }),
  submitRequest: async () => ({
    assistantMessage: mockMessages[1], state: mockState, audit: mockAudit,
    classification: { handlingClass: "pure-dialogue" as const, retrievalNeeded: false, toolNeeded: false },
    retrievedSnippets: [], messages: mockMessages, conversations: [mockConversation]
  }),
  getAppInfo: () => ({ name: "Enso", version: "0.1.0-preview" })
};
