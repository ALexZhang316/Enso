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

export interface WorkspaceWritePendingAction {
  kind: "workspace_write";
  summary: string;
  targetPath: string;
  content: string;
  sourceRequestText: string;
  requestedAt: string;
}

export interface HostExecPendingAction {
  kind: "host_exec";
  summary: string;
  command: string;
  workingDirectory: string;
  sourceRequestText: string;
  requestedAt: string;
}

export type PendingAction = WorkspaceWritePendingAction | HostExecPendingAction;

export interface StateSnapshot {
  conversationId: string;
  retrievalUsed: boolean;
  toolsCalled: string[];
  latestToolResult: string;
  pendingConfirmation: boolean;
  pendingAction: PendingAction | null;
  taskStatus: "idle" | "processing" | "completed" | "awaiting_confirmation";
  updatedAt: string;
  plan: ExecutionPlan | null;
  trace: TraceEntry[];
  verification: VerificationResult | null;
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

export interface ExecutionPlan {
  goal: string;
  steps: string[];
  likelyTools: string[];
  verificationTarget: string;
}

export type TracePhase =
  | "classify"
  | "plan"
  | "retrieval"
  | "tool"
  | "model"
  | "verification"
  | "gate"
  | "persist";

export interface TraceEntry {
  phase: TracePhase;
  summary: string;
  timestamp: string;
}

export type VerificationStatus = "passed" | "skipped" | "blocked" | "failed";

export interface VerificationResult {
  status: VerificationStatus;
  detail: string;
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
  plan: ExecutionPlan | null;
  trace: TraceEntry[];
  verification: VerificationResult | null;
}

export interface InitializationPayload {
  config: EnsoConfig;
  conversations: Conversation[];
  activeConversationId: string;
  messages: ChatMessage[];
  state: StateSnapshot;
  audit: AuditSummary | null;
  knowledgeSources: KnowledgeSource[];
  workspaceRoot: string;
}
