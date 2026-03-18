import path from "node:path";
import { ModeId } from "../../shared/modes";
import {
  AuditSummary,
  ChatMessage,
  ExecutionInput,
  ExecutionPlan,
  ExecutionResult,
  PendingAction,
  RequestClassification,
  RetrievedSnippet,
  StateSnapshot,
  TraceEntry,
  VerificationResult
} from "../../shared/types";
import { ConfigService } from "../services/config-service";
import { KnowledgeService } from "../services/knowledge-service";
import { ModelAdapter } from "../services/model-adapter";
import { EnsoStore } from "../services/store";
import { ToolService, ToolRunResult } from "../services/tool-service";
import { WorkspaceService } from "../services/workspace-service";

interface ExecutionFlowDependencies {
  store: EnsoStore;
  configService: ConfigService;
  knowledgeService: KnowledgeService;
  toolService: ToolService;
  modelAdapter: ModelAdapter;
  workspaceService: WorkspaceService;
}

interface AssistantMessageMetadata extends Record<string, unknown> {
  mode: ModeId;
  handlingClass: RequestClassification["handlingClass"];
  retrievalUsed: boolean;
  retrievalEnabled?: boolean;
  toolName: string | null;
  toolSummary?: string;
  retrievalSnippetCount?: number;
  retrievalSources?: string[];
  retrievedSnippets?: RetrievedSnippet[];
  pendingActionSummary?: string;
  pendingActionTargetPath?: string;
  writtenPath?: string;
  providerError?: boolean;
}

interface ResolvePendingActionResult {
  assistantMessage: ChatMessage;
  state: StateSnapshot;
  audit: AuditSummary;
  verification: VerificationResult;
}

const actionIntentPatternEn =
  /\b(write|delete|remove|send|execute|publish|transfer|deploy|modify|update|save|create|generate)\b/i;
const actionIntentPatternZh =
  /(写|写入|删除|移除|发送|执行|发布|转账|部署|修改|更新|保存|创建|生成|整理)/;

const retrievalHintEn =
  /\b(search|find|look\s?up|retrieve|evidence|document|quote|source|reference|knowledge)\b/i;
const retrievalHintZh = /(搜索|查找|检索|查阅|引用|知识|来源|文档|证据)/;

const toolHintEn =
  /\b(calculate|compute|sum|average|multiply|divide|read\s?file|read)\b/i;
const toolHintZh = /(计算|求和|平均|乘|除|读取|阅读)/;

const workspaceWriteVerbEn = /\b(write|save|create|draft|generate|make)\b/i;
const workspaceWriteTargetEn =
  /\b(file|note|notes|report|summary|todo|checklist|markdown|md|document)\b/i;
const workspaceWriteZh = /(写|保存|创建|生成|整理).*(文件|笔记|纪要|总结|报告|待办|清单|文档)/;

const hasActionIntent = (text: string): boolean =>
  actionIntentPatternEn.test(text) || actionIntentPatternZh.test(text);

const hasRetrievalHint = (text: string): boolean =>
  retrievalHintEn.test(text) || retrievalHintZh.test(text);

const hasToolHint = (text: string): boolean =>
  toolHintEn.test(text) || toolHintZh.test(text);

const isWorkspaceWriteIntent = (text: string): boolean =>
  (workspaceWriteVerbEn.test(text) && workspaceWriteTargetEn.test(text)) || workspaceWriteZh.test(text);

const ts = (): string => new Date().toISOString();

const trace = (entries: TraceEntry[], phase: TraceEntry["phase"], summary: string): void => {
  entries.push({ phase, summary, timestamp: ts() });
};

const classifyRequest = (
  text: string,
  hasKnowledge: boolean,
  retrievalPreferred: boolean
): RequestClassification => {
  if (hasActionIntent(text)) {
    return { handlingClass: "action-adjacent", retrievalNeeded: false, toolNeeded: false };
  }

  const retrievalNeeded = hasKnowledge && (hasRetrievalHint(text) || retrievalPreferred);
  const toolNeeded = hasToolHint(text);

  if (toolNeeded) {
    return { handlingClass: "tool-assisted", retrievalNeeded, toolNeeded: true };
  }

  if (retrievalNeeded) {
    return { handlingClass: "retrieval-enhanced", retrievalNeeded: true, toolNeeded: false };
  }

  return { handlingClass: "pure-dialogue", retrievalNeeded: false, toolNeeded: false };
};

const buildPlan = (params: {
  classification: RequestClassification;
  text: string;
  workspaceWriteIntent: boolean;
  requiresWriteConfirmation: boolean;
}): ExecutionPlan | null => {
  const { classification, text, workspaceWriteIntent, requiresWriteConfirmation } = params;

  if (classification.handlingClass === "pure-dialogue") {
    return null;
  }

  const steps: string[] = [];
  const likelyTools: string[] = [];
  let verificationTarget = "response coherence";

  if (classification.handlingClass === "action-adjacent") {
    if (workspaceWriteIntent) {
      steps.push("draft workspace artifact");
      if (requiresWriteConfirmation) {
        steps.push("present write proposal", "wait for confirmation");
      } else {
        steps.push("write artifact into workspace");
      }
      steps.push("verify artifact exists");

      return {
        goal: "create workspace artifact",
        steps,
        likelyTools: ["workspace-write"],
        verificationTarget: "workspace artifact exists"
      };
    }

    return {
      goal: "gate unsupported action request",
      steps: ["detect action intent", "convert to proposal", "block execution"],
      likelyTools: [],
      verificationTarget: "gate blocked"
    };
  }

  if (classification.retrievalNeeded) {
    steps.push("retrieve from local knowledge");
    likelyTools.push("search");
    verificationTarget = "evidence exists in retrieved snippets";
  }

  if (classification.toolNeeded) {
    steps.push("run tool");
    likelyTools.push("compute", "read");
    verificationTarget = "tool produced a result";
  }

  steps.push("call model with assembled context", "verify result");

  return {
    goal: `answer: ${text.slice(0, 60)}${text.length > 60 ? "..." : ""}`,
    steps,
    likelyTools,
    verificationTarget
  };
};

const verify = (
  classification: RequestClassification,
  snippets: RetrievedSnippet[],
  toolResult: ToolRunResult | null,
  replyText: string
): VerificationResult => {
  if (classification.handlingClass === "action-adjacent") {
    return { status: "blocked", detail: "action request blocked behind an explicit gate" };
  }

  if (classification.handlingClass === "pure-dialogue") {
    return replyText.length > 0
      ? { status: "passed", detail: "model produced a reply" }
      : { status: "failed", detail: "model returned empty reply" };
  }

  const checks: Array<{ ok: boolean; label: string }> = [];

  if (classification.retrievalNeeded) {
    checks.push({ ok: snippets.length > 0, label: "retrieval returned snippets" });
  }

  if (classification.toolNeeded) {
    checks.push({ ok: toolResult !== null, label: "tool produced a result" });
  }

  checks.push({ ok: replyText.length > 0, label: "model produced a reply" });

  const detail = checks.map((check) => `${check.ok ? "[ok]" : "[fail]"} ${check.label}`).join("; ");
  return {
    status: checks.every((check) => check.ok) ? "passed" : "failed",
    detail
  };
};

const buildWorkspaceDraftFallback = (requestText: string): string => [
  "# Workspace Draft",
  "",
  "## Request",
  requestText,
  "",
  "## Draft",
  "- This file was created from a gated workspace-write request.",
  "- Replace this placeholder content with a refined version if needed."
].join("\n");

const buildWorkspaceProposalText = (pendingAction: PendingAction): string => {
  const preview = pendingAction.content.trim().slice(0, 600);

  return [
    "检测到工作区写入请求。",
    "已生成待确认提案，确认后会把内容写入 Enso 工作区。",
    `目标路径: ${pendingAction.targetPath}`,
    "",
    "预览:",
    "```md",
    preview,
    "```"
  ].join("\n");
};

const buildAssistantMessageMetadata = (params: {
  input: ExecutionInput;
  classification: RequestClassification;
  snippets: RetrievedSnippet[];
  toolResult: ToolRunResult | null;
  retrievalEnabled?: boolean;
  pendingAction?: PendingAction | null;
  writtenPath?: string;
  providerError?: boolean;
}): AssistantMessageMetadata => {
  const { input, classification, snippets, toolResult, retrievalEnabled, pendingAction, writtenPath, providerError } =
    params;

  const metadata: AssistantMessageMetadata = {
    mode: input.mode,
    handlingClass: classification.handlingClass,
    retrievalUsed: snippets.length > 0,
    toolName: toolResult?.toolName ?? null
  };

  if (typeof retrievalEnabled === "boolean") {
    metadata.retrievalEnabled = retrievalEnabled;
  }

  if (toolResult) {
    metadata.toolSummary = toolResult.summary;
  }

  metadata.retrievedSnippets = snippets;
  metadata.retrievalSnippetCount = snippets.length;
  metadata.retrievalSources = [...new Set(snippets.map((snippet) => snippet.sourceName))];

  if (pendingAction) {
    metadata.pendingActionSummary = pendingAction.summary;
    metadata.pendingActionTargetPath = pendingAction.targetPath;
  }

  if (writtenPath) {
    metadata.toolName = "workspace-write";
    metadata.toolSummary = `wrote ${path.basename(writtenPath)}`;
    metadata.writtenPath = writtenPath;
  }

  if (providerError) {
    metadata.providerError = true;
  }

  return metadata;
};

export class ExecutionFlow {
  constructor(private readonly deps: ExecutionFlowDependencies) {}

  async run(input: ExecutionInput): Promise<ExecutionResult> {
    const conversation = this.deps.store.getConversation(input.conversationId);
    if (!conversation) {
      throw new Error("未找到当前会话。");
    }

    this.deps.store.setConversationMode(input.conversationId, input.mode);

    const config = this.deps.configService.load();
    const history = this.deps.store.listRecentMessages(input.conversationId, 12);
    const traceLog: TraceEntry[] = [];
    const knowledgeSources = this.deps.store.listKnowledgeSources();
    const hasKnowledge = knowledgeSources.length > 0;
    const retrievalPreferred =
      input.enableRetrievalForTurn || config.modeDefaults.retrievalByMode[input.mode];
    const classification = classifyRequest(input.text, hasKnowledge, retrievalPreferred);
    const workspaceWriteIntent =
      classification.handlingClass === "action-adjacent" && isWorkspaceWriteIntent(input.text);
    const requiresWriteConfirmation =
      config.permissions.readOnlyDefault || config.permissions.requireConfirmationForWrites;

    trace(
      traceLog,
      "classify",
      `class=${classification.handlingClass} retrieval=${classification.retrievalNeeded} tool=${classification.toolNeeded}`
    );

    this.deps.store.addMessage(input.conversationId, "user", input.text, {
      mode: input.mode,
      handlingClass: classification.handlingClass,
      retrievalEnabled: classification.retrievalNeeded
    });

    const plan = buildPlan({
      classification,
      text: input.text,
      workspaceWriteIntent,
      requiresWriteConfirmation
    });
    if (plan) {
      trace(traceLog, "plan", `goal=${plan.goal} steps=${plan.steps.length}`);
    }

    if (classification.handlingClass === "action-adjacent") {
      if (workspaceWriteIntent) {
        const pendingAction = await this.createWorkspaceWriteProposal({
          input,
          config,
          history,
          traceLog
        });

        if (requiresWriteConfirmation) {
          trace(traceLog, "gate", "workspace write proposal pending confirmation");

          const proposalText = buildWorkspaceProposalText(pendingAction);
          const assistantMessage = this.deps.store.addMessage(
            input.conversationId,
            "assistant",
            proposalText,
            buildAssistantMessageMetadata({
              input,
              classification,
              snippets: [],
              toolResult: null,
              retrievalEnabled: retrievalPreferred,
              pendingAction
            })
          );

          const verification: VerificationResult = {
            status: "blocked",
            detail: "workspace write proposal pending confirmation"
          };
          trace(traceLog, "verification", `status=${verification.status}`);
          trace(traceLog, "persist", "state and audit written");

          const nextState = this.deps.store.upsertState({
            conversationId: input.conversationId,
            retrievalUsed: false,
            toolsCalled: [],
            latestToolResult: "",
            pendingConfirmation: true,
            pendingAction,
            taskStatus: "awaiting_confirmation",
            updatedAt: ts(),
            plan,
            trace: traceLog,
            verification
          });

          const audit = this.deps.store.addAudit({
            conversationId: input.conversationId,
            mode: input.mode,
            retrievalUsed: false,
            toolsUsed: ["workspace-write"],
            resultType: "proposal",
            riskNotes: `waiting for confirmation: ${pendingAction.targetPath}`
          });

          return {
            assistantMessage,
            state: nextState,
            audit,
            classification,
            retrievedSnippets: [],
            plan,
            trace: traceLog,
            verification
          };
        }

        const resolution = this.executeWorkspaceWrite({
          conversationId: input.conversationId,
          mode: input.mode,
          pendingAction,
          plan,
          traceLog,
          classification,
          responseTextPrefix: "已执行工作区写入。"
        });

        return {
          assistantMessage: resolution.assistantMessage,
          state: resolution.state,
          audit: resolution.audit,
          classification,
          retrievedSnippets: [],
          plan,
          trace: resolution.state.trace,
          verification: resolution.verification
        };
      }

      trace(traceLog, "gate", "unsupported action remains blocked");
      const proposalText =
        "检测到动作类请求，但当前仅支持工作区内写入提案。外部执行、工作区外写入和破坏性动作仍保持阻断。";
      const assistantMessage = this.deps.store.addMessage(
        input.conversationId,
        "assistant",
        proposalText,
        buildAssistantMessageMetadata({
          input,
          classification,
          snippets: [],
          toolResult: null,
          retrievalEnabled: retrievalPreferred
        })
      );

      const verification: VerificationResult = {
        status: "blocked",
        detail: "unsupported action blocked"
      };
      trace(traceLog, "verification", `status=${verification.status}`);
      trace(traceLog, "persist", "state and audit written");

      const nextState = this.deps.store.upsertState({
        conversationId: input.conversationId,
        retrievalUsed: false,
        toolsCalled: [],
        latestToolResult: "",
        pendingConfirmation: false,
        pendingAction: null,
        taskStatus: "completed",
        updatedAt: ts(),
        plan,
        trace: traceLog,
        verification
      });

      const audit = this.deps.store.addAudit({
        conversationId: input.conversationId,
        mode: input.mode,
        retrievalUsed: false,
        toolsUsed: [],
        resultType: "proposal",
        riskNotes: "unsupported action blocked"
      });

      return {
        assistantMessage,
        state: nextState,
        audit,
        classification,
        retrievedSnippets: [],
        plan,
        trace: traceLog,
        verification
      };
    }

    let snippets: RetrievedSnippet[] = [];
    if (classification.retrievalNeeded) {
      snippets = this.deps.knowledgeService.retrieve(input.text, 5);
      trace(traceLog, "retrieval", `returned ${snippets.length} snippets`);
    }

    let toolResult: ToolRunResult | null = null;
    if (classification.toolNeeded) {
      toolResult = this.deps.toolService.decideAndRun(input.text, snippets);
      trace(
        traceLog,
        "tool",
        toolResult
          ? `tool=${toolResult.toolName} summary=${toolResult.summary}`
          : "no tool matched"
      );
    }

    try {
      const contextParts: string[] = [];

      if (snippets.length > 0) {
        const evidenceBlock = snippets
          .map((snippet, index) => `[证据${index + 1}] (${snippet.sourceName})\n${snippet.content}`)
          .join("\n\n");
        contextParts.push(`以下是从本地知识库检索到的相关证据：\n\n${evidenceBlock}`);
      }

      if (toolResult) {
        contextParts.push(`工具执行结果 [${toolResult.toolName}]: ${toolResult.summary}`);
      }

      const enrichedUserText =
        contextParts.length > 0
          ? `${contextParts.join("\n\n")}\n\n用户问题: ${input.text}`
          : input.text;

      trace(traceLog, "model", "calling model with assembled context");

      const replyText = await this.deps.modelAdapter.generateReply({
        config,
        history,
        userText: enrichedUserText
      });

      const verification = verify(classification, snippets, toolResult, replyText);
      trace(traceLog, "verification", `status=${verification.status} detail=${verification.detail}`);

      const assistantMessage = this.deps.store.addMessage(
        input.conversationId,
        "assistant",
        replyText,
        buildAssistantMessageMetadata({
          input,
          classification,
          snippets,
          toolResult,
          retrievalEnabled: retrievalPreferred
        })
      );

      trace(traceLog, "persist", "state and audit written");

      const nextState = this.deps.store.upsertState({
        conversationId: input.conversationId,
        retrievalUsed: snippets.length > 0,
        toolsCalled: toolResult ? [toolResult.toolName] : [],
        latestToolResult: toolResult?.summary ?? "",
        pendingConfirmation: false,
        pendingAction: null,
        taskStatus: "completed",
        updatedAt: ts(),
        plan,
        trace: traceLog,
        verification
      });

      const audit = this.deps.store.addAudit({
        conversationId: input.conversationId,
        mode: input.mode,
        retrievalUsed: snippets.length > 0,
        toolsUsed: toolResult ? [toolResult.toolName] : [],
        resultType: "answer",
        riskNotes: verification.status === "failed" ? verification.detail : ""
      });

      return {
        assistantMessage,
        state: nextState,
        audit,
        classification,
        retrievedSnippets: snippets,
        plan,
        trace: nextState.trace,
        verification
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "模型调用失败。";
      trace(traceLog, "model", `error: ${errorMessage}`);

      const verification: VerificationResult = { status: "failed", detail: errorMessage };
      trace(traceLog, "verification", `status=failed detail=${errorMessage}`);

      const assistantMessage = this.deps.store.addMessage(
        input.conversationId,
        "assistant",
        `本次请求失败：${errorMessage}`,
        buildAssistantMessageMetadata({
          input,
          classification,
          snippets,
          toolResult,
          retrievalEnabled: retrievalPreferred,
          providerError: true
        })
      );

      trace(traceLog, "persist", "error state written");

      const nextState = this.deps.store.upsertState({
        conversationId: input.conversationId,
        retrievalUsed: snippets.length > 0,
        toolsCalled: toolResult ? [toolResult.toolName] : [],
        latestToolResult: toolResult?.summary ?? "",
        pendingConfirmation: false,
        pendingAction: null,
        taskStatus: "completed",
        updatedAt: ts(),
        plan,
        trace: traceLog,
        verification
      });

      const audit = this.deps.store.addAudit({
        conversationId: input.conversationId,
        mode: input.mode,
        retrievalUsed: snippets.length > 0,
        toolsUsed: toolResult ? [toolResult.toolName] : [],
        resultType: "answer",
        riskNotes: errorMessage
      });

      return {
        assistantMessage,
        state: nextState,
        audit,
        classification,
        retrievedSnippets: snippets,
        plan,
        trace: nextState.trace,
        verification
      };
    }
  }

  resolvePendingAction(conversationId: string): ResolvePendingActionResult {
    const conversation = this.deps.store.getConversation(conversationId);
    if (!conversation) {
      throw new Error("未找到当前会话。");
    }

    const currentState = this.deps.store.getState(conversationId);
    if (!currentState.pendingConfirmation || !currentState.pendingAction) {
      throw new Error("没有待确认的动作。");
    }

    const traceLog = [...currentState.trace];
    trace(traceLog, "gate", "confirmation received");

    return this.executeWorkspaceWrite({
      conversationId,
      mode: conversation.mode,
      pendingAction: currentState.pendingAction,
      plan: currentState.plan,
      traceLog,
      classification: {
        handlingClass: "action-adjacent",
        retrievalNeeded: false,
        toolNeeded: false
      },
      responseTextPrefix: "已根据确认执行工作区写入。"
    });
  }

  private async createWorkspaceWriteProposal(params: {
    input: ExecutionInput;
    config: ReturnType<ConfigService["load"]>;
    history: ChatMessage[];
    traceLog: TraceEntry[];
  }): Promise<PendingAction> {
    const { input, config, history, traceLog } = params;
    const draftPrompt = [
      "你正在为一个待确认的本地工作区写入动作生成文件内容。",
      "请只返回要写入 Markdown 文件的正文，不要加解释，不要写代码围栏。",
      `用户请求: ${input.text}`
    ].join("\n");

    try {
      trace(traceLog, "model", "drafting workspace artifact content");
      const content = await this.deps.modelAdapter.generateReply({
        config,
        history,
        userText: draftPrompt
      });

      return this.deps.workspaceService.buildWorkspaceWriteProposal({
        requestText: input.text,
        content: content.trim() || buildWorkspaceDraftFallback(input.text)
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "draft fallback";
      trace(traceLog, "model", `workspace draft fallback: ${errorMessage}`);

      return this.deps.workspaceService.buildWorkspaceWriteProposal({
        requestText: input.text,
        content: buildWorkspaceDraftFallback(input.text)
      });
    }
  }

  private executeWorkspaceWrite(params: {
    conversationId: string;
    mode: ModeId;
    pendingAction: PendingAction;
    plan: ExecutionPlan | null;
    traceLog: TraceEntry[];
    classification: RequestClassification;
    responseTextPrefix: string;
  }): ResolvePendingActionResult {
    const { conversationId, mode, pendingAction, plan, traceLog, classification, responseTextPrefix } =
      params;

    trace(traceLog, "tool", `workspace-write target=${pendingAction.targetPath}`);
    const writeResult = this.deps.workspaceService.executePendingAction(pendingAction);
    const fileExists = this.deps.workspaceService.verifyPendingAction(pendingAction);
    const verification: VerificationResult = fileExists
      ? {
          status: "passed",
          detail: `workspace artifact exists: ${writeResult.targetPath}`
        }
      : {
          status: "failed",
          detail: `workspace artifact missing after write: ${writeResult.targetPath}`
        };
    trace(traceLog, "verification", `status=${verification.status} detail=${verification.detail}`);

    const assistantMessage = this.deps.store.addMessage(
      conversationId,
      "assistant",
      [
        responseTextPrefix,
        `路径: ${writeResult.targetPath}`,
        `写入字节: ${writeResult.bytesWritten}`,
        fileExists ? "验证: 文件已存在。" : "验证: 文件不存在。"
      ].join("\n"),
      buildAssistantMessageMetadata({
        input: {
          conversationId,
          mode,
          text: pendingAction.sourceRequestText,
          enableRetrievalForTurn: false
        },
        classification,
        snippets: [],
        toolResult: null,
        pendingAction,
        writtenPath: writeResult.targetPath
      })
    );

    trace(traceLog, "persist", "state and audit written");

    const nextState = this.deps.store.upsertState({
      conversationId,
      retrievalUsed: false,
      toolsCalled: ["workspace-write"],
      latestToolResult: `wrote ${path.basename(writeResult.targetPath)}`,
      pendingConfirmation: false,
      pendingAction: null,
      taskStatus: "completed",
      updatedAt: ts(),
      plan,
      trace: traceLog,
      verification
    });

    const audit = this.deps.store.addAudit({
      conversationId,
      mode,
      retrievalUsed: false,
      toolsUsed: ["workspace-write"],
      resultType: "answer",
      riskNotes: verification.status === "failed" ? verification.detail : ""
    });

    return {
      assistantMessage,
      state: nextState,
      audit,
      verification
    };
  }
}
