import { ModeId } from "./modes";
import {
  AuditSummary,
  ChatMessage,
  Conversation,
  EnsoConfig,
  ExecutionInput,
  ExecutionResult,
  InitializationPayload,
  RetrievedSnippet,
  StateSnapshot,
  KnowledgeSource
} from "./types";

export interface ConversationViewPayload {
  activeConversationId: string;
  messages: ChatMessage[];
  state: StateSnapshot;
  audit: AuditSummary | null;
  mode?: ModeId;
}

export interface ConversationsPayload extends ConversationViewPayload {
  conversations: Conversation[];
}

export interface ImportKnowledgePayload {
  imported: KnowledgeSource[];
  skipped: string[];
  knowledgeSources: KnowledgeSource[];
}

export interface SubmitRequestPayload extends ExecutionResult {
  messages: ChatMessage[];
  conversations: Conversation[];
}

export interface EnsoBridge {
  initialize: () => Promise<InitializationPayload>;
  createConversation: (title?: string) => Promise<ConversationsPayload>;
  selectConversation: (conversationId: string) => Promise<ConversationViewPayload>;
  renameConversation: (conversationId: string, title: string) => Promise<Conversation[]>;
  deleteConversation: (conversationId: string) => Promise<ConversationsPayload>;
  togglePinConversation: (conversationId: string) => Promise<Conversation[]>;
  setMode: (conversationId: string, mode: ModeId) => Promise<Conversation | null>;
  getConfig: () => Promise<EnsoConfig>;
  saveConfig: (config: EnsoConfig) => Promise<EnsoConfig>;
  importKnowledgeFiles: () => Promise<ImportKnowledgePayload>;
  retrieveKnowledge: (query: string) => Promise<RetrievedSnippet[]>;
  submitRequest: (input: ExecutionInput) => Promise<SubmitRequestPayload>;
  getAppInfo: () => { name: string; version: string };
}
