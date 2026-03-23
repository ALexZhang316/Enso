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

export type ActionType = "workspace_write" | "host_exec_readonly" | "host_exec_destructive" | "external_network";

export type PermissionLevel = "allow" | "confirm" | "block";

export const ACTION_TYPES: ActionType[] = [
  "workspace_write",
  "host_exec_readonly",
  "host_exec_destructive",
  "external_network"
];

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  workspace_write: "\u5de5\u4f5c\u533a\u5199\u5165",
  host_exec_readonly: "\u672c\u5730\u53ea\u8bfb\u547d\u4ee4",
  host_exec_destructive: "\u672c\u5730\u7834\u574f\u6027\u547d\u4ee4",
  external_network: "\u5916\u90e8\u7f51\u7edc"
};

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  allow: "\u5141\u8bb8",
  confirm: "\u786e\u8ba4",
  block: "\u7981\u6b62"
};

export interface EnsoConfig {
  provider: ProviderConfig;
  expression: {
    density: "concise" | "standard" | "detailed";
    structuredFirst: boolean;
  };
  reportingGranularity: "plan-level" | "result-level";
  permissions: Record<ActionType, PermissionLevel>;
  modeDefaults: {
    defaultMode: ModeId;
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

export type TracePhase = "classify" | "plan" | "retrieval" | "tool" | "model" | "verification" | "gate" | "persist";

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

export interface ModelExpressionConfig {
  density: EnsoConfig["expression"]["density"];
  structuredFirst: EnsoConfig["expression"]["structuredFirst"];
  reportingGranularity: EnsoConfig["reportingGranularity"];
}

export interface StructuredExecutionDraft {
  answer: string;
  riskNotes: string[];
  evidenceRefs: string[];
  plannedTools: string[];
  verificationTarget: string;
  needsConfirmation: boolean;
}

export interface ToolRunResult {
  toolName: "read" | "search" | "compute" | "workspace-write" | "exec";
  success: boolean;
  output: string;
  sideEffects: string[];
  error?: string;
}
