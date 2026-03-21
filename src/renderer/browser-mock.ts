/**
 * Browser-only mock for window.enso.
 * Enables Vite dev preview without Electron's preload layer.
 * Only injected when window.enso is not already defined (i.e. not in Electron).
 */
import type { EnsoBridge } from "@shared/bridge";
import { DEFAULT_MODE } from "@shared/modes";

const CONV_ID = "mock-conv-1";
const NOW = new Date().toISOString();

const mockConfig = {
  provider: {
    provider: "kimi" as const,
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k2.5",
    apiKey: ""
  },
  expression: {
    density: "standard" as const,
    structuredFirst: false
  },
  reportingGranularity: "plan-level" as const,
  permissions: {
    readOnlyDefault: true,
    requireConfirmationForWrites: true,
    requireDoubleConfirmationForExternal: true
  },
  modeDefaults: {
    defaultMode: DEFAULT_MODE,
    retrievalByMode: {
      default: false,
      "deep-dialogue": false,
      decision: true,
      research: true
    }
  }
};

const mockConversation = {
  id: CONV_ID,
  title: "示例会话",
  mode: DEFAULT_MODE,
  pinned: false,
  createdAt: NOW,
  updatedAt: NOW
};

const mockMessages = [
  {
    id: "msg-1",
    conversationId: CONV_ID,
    role: "user" as const,
    content: "请先概括一下这次任务的重点。",
    createdAt: NOW
  },
  {
    id: "msg-2",
    conversationId: CONV_ID,
    role: "assistant" as const,
    content:
      "当前处于默认模式。我会先给出平衡回答，需要时再建议检索或工具，而不会默认走重工具链。",
    createdAt: NOW
  }
];

const mockState = {
  conversationId: CONV_ID,
  retrievalUsed: false,
  toolsCalled: [] as string[],
  latestToolResult: "",
  pendingConfirmation: false,
  pendingAction: null,
  taskStatus: "idle" as const,
  updatedAt: NOW,
  plan: null,
  trace: [] as Array<{ phase: string; summary: string; timestamp: string }>,
  verification: null
};

const mockAudit = {
  id: "audit-1",
  conversationId: CONV_ID,
  mode: DEFAULT_MODE,
  retrievalUsed: false,
  toolsUsed: [] as string[],
  resultType: "answer" as const,
  riskNotes: "",
  createdAt: NOW
};

export const mockBridge: EnsoBridge = {
  initialize: async () => ({
    config: mockConfig,
    conversations: [mockConversation],
    activeConversationId: CONV_ID,
    messages: mockMessages,
    state: mockState,
    audit: mockAudit,
    knowledgeSources: [],
    workspaceRoot: "C:\\Mock\\Enso\\workspace"
  }),
  createConversation: async () => ({
    conversations: [mockConversation],
    activeConversationId: CONV_ID,
    messages: [],
    state: mockState,
    audit: null,
    mode: DEFAULT_MODE
  }),
  selectConversation: async () => ({
    activeConversationId: CONV_ID,
    messages: mockMessages,
    state: mockState,
    audit: mockAudit,
    mode: DEFAULT_MODE
  }),
  renameConversation: async () => [mockConversation],
  deleteConversation: async () => ({
    conversations: [mockConversation],
    activeConversationId: CONV_ID,
    messages: mockMessages,
    state: mockState,
    audit: mockAudit
  }),
  togglePinConversation: async () => [mockConversation],
  setMode: async (_conversationId, mode) => ({
    ...mockConversation,
    mode
  }),
  getConfig: async () => mockConfig,
  saveConfig: async () => mockConfig,
  hasProviderApiKey: async () => false,
  clearProviderApiKey: async () => true,
  importKnowledgeFiles: async () => ({ imported: [], skipped: [], knowledgeSources: [] }),
  retrieveKnowledge: async () => [],
  listAudits: async () => [mockAudit],
  resolvePendingConfirmation: async () => ({
    messages: mockMessages,
    state: mockState,
    audit: mockAudit
  }),
  submitRequest: async () => ({
    assistantMessage: mockMessages[1],
    state: mockState,
    audit: mockAudit,
    classification: {
      handlingClass: "pure-dialogue" as const,
      retrievalNeeded: false,
      toolNeeded: false
    },
    retrievedSnippets: [],
    plan: null,
    trace: [],
    verification: null,
    messages: mockMessages,
    conversations: [mockConversation]
  }),
  getAppInfo: () => ({ name: "Enso", version: "0.1.0-preview" })
};
