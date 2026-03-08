import { ModeId } from "./modes";
import { ProviderId } from "./providers";

export type MessageRole = "user" | "assistant" | "system";

export interface Conversation {
  id: string;
  title: string;
  mode: ModeId;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface StateSnapshot {
  conversationId: string;
  retrievalUsed: boolean;
  toolsCalled: string[];
  latestToolResult: string;
  pendingConfirmation: boolean;
  taskStatus: "idle" | "processing" | "completed" | "awaiting_confirmation";
  updatedAt: string;
}

export interface AuditSummary {
  id: string;
  conversationId: string;
  mode: ModeId;
  retrievalUsed: boolean;
  toolsUsed: string[];
  resultType: "answer" | "proposal" | "dry_run";
  riskNotes: string;
  createdAt: string;
}

export interface KnowledgeSource {
  id: string;
  name: string;
  path: string;
  chunkCount: number;
  createdAt: string;
}

export interface RetrievedSnippet {
  chunkId: string;
  sourceId: string;
  sourceName: string;
  sourcePath: string;
  content: string;
  score: number;
}

export interface ProviderConfig {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface EnsoConfig {
  provider: ProviderConfig;
  expression: {
    style: "direct" | "balanced";
    reducedQuestioning: boolean;
    defaultAssumption: "conservative" | "pragmatic";
    riskLabeling: "always" | "balanced-only" | "off";
  };
  permissions: {
    readOnlyDefault: boolean;
    requireConfirmationForWrites: boolean;
    requireDoubleConfirmationForExternal: boolean;
  };
  modeDefaults: {
    defaultMode: ModeId;
    retrievalByMode: Record<ModeId, boolean>;
  };
}

export interface RequestClassification {
  handlingClass: "pure-dialogue" | "retrieval-enhanced" | "tool-assisted" | "action-adjacent";
  retrievalNeeded: boolean;
  toolNeeded: boolean;
}

export interface ExecutionInput {
  conversationId: string;
  mode: ModeId;
  text: string;
  enableRetrievalForTurn: boolean;
}

export interface ExecutionResult {
  assistantMessage: ChatMessage;
  state: StateSnapshot;
  audit: AuditSummary;
  classification: RequestClassification;
  retrievedSnippets: RetrievedSnippet[];
}

export interface InitializationPayload {
  config: EnsoConfig;
  conversations: Conversation[];
  activeConversationId: string;
  messages: ChatMessage[];
  state: StateSnapshot;
  audit: AuditSummary | null;
  knowledgeSources: KnowledgeSource[];
}
