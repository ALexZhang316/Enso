import path from "node:path";
import { ModeId } from "../../shared/modes";
import {
  AuditSummary,
  ChatMessage,
  ExecutionInput,
  ExecutionPlan,
  ExecutionResult,
  HostExecPendingAction,
  PendingAction,
  RequestClassification,
  RetrievedSnippet,
  StateSnapshot,
  TraceEntry,
  VerificationResult,
  WorkspaceWritePendingAction
} from "../../shared/types";
import { ConfigService } from "../services/config-service";
import { HostExecRunResult, HostExecSafetyError, HostExecService } from "../services/host-exec-service";
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
  hostExecService: HostExecService;
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

type ResolvedActionResult =
  | {
      kind: "workspace_write";
      targetPath: string;
      bytesWritten: number;
    }
  | {
      kind: "host_exec";
      command: string;
      workingDirectory: string;
      exitCode: number;
      stdout: string;
      stderr: string;
    };

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
const hostExecIntentEn = /\b(run|execute)(?:\s+the)?(?:\s+command)?\b/i;
const hostExecIntentZh = /(运行|执行)(命令)?/;
const inlineCommandPattern = /`([^`\r\n]{1,200})`/;
const hostExecTailEn = /\b(?:run|execute)(?:\s+the)?(?:\s+command)?[:：]?\s+([A-Za-z][^\r\n]{1,200})$/i;
const hostExecTailZh = /(?:运行|执行)(?:命令)?[:：]?\s*([A-Za-z][^\r\n]{1,200})$/;
const blockedActionVerbEn =
  /\b(delete|remove|send|execute|run|publish|transfer|deploy|rename|move|install|edit|modify|rewrite|update)\b/i;
const blockedActionTargetEn =
  /\b(file|files|folder|folders|directory|directories|repo|repository|readme|config|code|app|application|email|message|command|commands|server|deployment|branch)\b/i;
const blockedActionZh =
  /(删除|移除|发送|执行|运行|发布|转账|部署|重命名|移动|安装|编辑|修改|改写|更新).*(文件|文件夹|目录|仓库|README|配置|代码|应用|邮件|消息|命令|服务器|分支|部署)/;
const informationalPromptEn =
  /^\s*(what(?:'s| is)?|how(?:\s+do|\s+to|\s+can)?|why|who|when|where)\b/i;
const informationalActionPhraseEn =
  /\b(can you explain|could you explain|please explain|help me understand|tell me about|update me on|can you update me on|could you update me on|how do i|how to)\b/i;
const informationalPromptZh =
  /^\s*(什么是|如何|怎么|为何|为什么|谁是|哪里|哪儿|帮我理解|解释一下|介绍一下|告诉我|更新一下)\b/;
const informationalActionPhraseZh = /(帮我理解|解释一下|介绍一下|告诉我|更新一下(当前|现状|状态))/;

const hasRetrievalHint = (text: string): boolean =>
  retrievalHintEn.test(text) || retrievalHintZh.test(text);

const hasToolHint = (text: string): boolean =>
  toolHintEn.test(text) || toolHintZh.test(text);

const isInformationalPrompt = (text: string): boolean =>
  informationalPromptEn.test(text) ||
  informationalActionPhraseEn.test(text) ||
  informationalPromptZh.test(text) ||
  informationalActionPhraseZh.test(text);

const cleanExtractedCommand = (value: string): string =>
  value.trim().replace(/[。！？!?.]+$/u, "").trim();

const extractHostExecCommand = (text: string): string | null => {
  if (isInformationalPrompt(text)) {
    return null;
  }

  const inlineMatch = text.match(inlineCommandPattern);
  if (inlineMatch && (hostExecIntentEn.test(text) || hostExecIntentZh.test(text))) {
    return cleanExtractedCommand(inlineMatch[1]);
  }

  const tailMatch = text.match(hostExecTailEn) ?? text.match(hostExecTailZh);
  return tailMatch ? cleanExtractedCommand(tailMatch[1]) : null;
};

const isWorkspaceWriteIntent = (text: string): boolean => {
  if (isInformationalPrompt(text)) {
    return false;
  }

  return (workspaceWriteVerbEn.test(text) && workspaceWriteTargetEn.test(text)) || workspaceWriteZh.test(text);
};

const hasExplicitBlockedActionIntent = (text: string): boolean => {
  if (isInformationalPrompt(text)) {
    return false;
  }

  return (blockedActionVerbEn.test(text) && blockedActionTargetEn.test(text)) || blockedActionZh.test(text);
};

const ts = (): string => new Date().toISOString();

const trace = (entries: TraceEntry[], phase: TraceEntry["phase"], summary: string): void => {
  entries.push({ phase, summary, timestamp: ts() });
};

const classifyRequest = (
  text: string,
  hasKnowledge: boolean,
  retrievalPreferred: boolean
): RequestClassification => {
  const hostExecCommand = extractHostExecCommand(text);

  if (isWorkspaceWriteIntent(text) || hostExecCommand !== null || hasExplicitBlockedActionIntent(text)) {
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
  hostExecIntent: boolean;
  requiresWriteConfirmation: boolean;
}): ExecutionPlan | null => {
  const { classification, text, workspaceWriteIntent, hostExecIntent, requiresWriteConfirmation } = params;

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

    if (hostExecIntent) {
      steps.push("prepare host exec proposal", "wait for confirmation", "run command inside workspace", "verify exit status");
      return {
        goal: "run host command in workspace",
        steps,
        likelyTools: ["exec"],
        verificationTarget: "command exit status is acceptable"
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

const buildPendingActionProposalText = (pendingAction: PendingAction): string => {
  if (pendingAction.kind === "workspace_write") {
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
  }

  return [
    "检测到主机命令执行请求。",
    "已生成待确认提案，确认后会在 Enso 工作区内执行只读命令。",
    `工作目录: ${pendingAction.workingDirectory}`,
    "",
    "命令:",
    "```powershell",
    pendingAction.command,
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
    if (pendingAction.kind === "workspace_write") {
      metadata.pendingActionTargetPath = pendingAction.targetPath;
    }
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
    const hostExecCommand = extractHostExecCommand(input.text);
    const retrievalPreferred =
      input.enableRetrievalForTurn || config.modeDefaults.retrievalByMode[input.mode];
    const classification = classifyRequest(input.text, hasKnowledge, retrievalPreferred);
    const workspaceWriteIntent =
      classification.handlingClass === "action-adjacent" && isWorkspaceWriteIntent(input.text);
    const safeHostExecIntent =
      classification.handlingClass === "action-adjacent" &&
      hostExecCommand !== null &&
      this.deps.hostExecService.isAllowedCommand(hostExecCommand);
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
      hostExecIntent: safeHostExecIntent,
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

          const proposalText = buildPendingActionProposalText(pendingAction);
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

      if (safeHostExecIntent && hostExecCommand) {
        const pendingAction = this.deps.hostExecService.buildHostExecProposal({
          requestText: input.text,
          command: hostExecCommand
        });

        trace(traceLog, "gate", "host exec proposal pending confirmation");

        const assistantMessage = this.deps.store.addMessage(
          input.conversationId,
          "assistant",
          buildPendingActionProposalText(pendingAction),
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
          detail: "host exec proposal pending confirmation"
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
          toolsUsed: ["exec"],
          resultType: "proposal",
          riskNotes: `waiting for confirmation: ${pendingAction.command}`
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

      trace(traceLog, "gate", "unsupported action remains blocked");
      const proposalText =
        hostExecCommand
          ? "检测到主机命令请求，但当前仅支持在 Enso 工作区内执行只读命令。破坏性命令、外部动作和工作区外执行仍保持阻断。"
          : "检测到动作类请求，但当前仅支持工作区内写入提案和工作区内只读命令执行提案。外部执行、工作区外写入和破坏性动作仍保持阻断。";
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
        riskNotes: hostExecCommand ? "unsupported host exec command blocked" : "unsupported action blocked"
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

    if (currentState.pendingAction.kind === "workspace_write") {
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

    return this.executeHostExec({
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
      responseTextPrefix: "已根据确认执行工作区命令。"
    });
  }

  private async createWorkspaceWriteProposal(params: {
    input: ExecutionInput;
    config: ReturnType<ConfigService["load"]>;
    history: ChatMessage[];
    traceLog: TraceEntry[];
  }): Promise<WorkspaceWritePendingAction> {
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
    pendingAction: Extract<PendingAction, { kind: "workspace_write" }>;
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

  private executeHostExec(params: {
    conversationId: string;
    mode: ModeId;
    pendingAction: HostExecPendingAction;
    plan: ExecutionPlan | null;
    traceLog: TraceEntry[];
    classification: RequestClassification;
    responseTextPrefix: string;
  }): ResolvePendingActionResult {
    const { conversationId, mode, pendingAction, plan, traceLog, classification, responseTextPrefix } =
      params;

    trace(traceLog, "tool", `exec command=${pendingAction.command}`);

    let execResult: HostExecRunResult;
    try {
      execResult = this.deps.hostExecService.executePendingAction(pendingAction);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "host exec failed";
      const verification: VerificationResult = { status: "failed", detail };
      trace(traceLog, "verification", `status=${verification.status} detail=${verification.detail}`);

      const assistantMessage = this.deps.store.addMessage(
        conversationId,
        "assistant",
        `${responseTextPrefix}\n命令: ${pendingAction.command}\n验证: ${detail}`,
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
          pendingAction
        })
      );

      trace(traceLog, "persist", "state and audit written");
      const nextState = this.deps.store.upsertState({
        conversationId,
        retrievalUsed: false,
        toolsCalled: ["exec"],
        latestToolResult: detail,
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
        toolsUsed: ["exec"],
        resultType: "answer",
        riskNotes: detail
      });

      return {
        assistantMessage,
        state: nextState,
        audit,
        verification
      };
    }

    const verification: VerificationResult = this.deps.hostExecService.verifyPendingAction(execResult)
      ? {
          status: "passed",
          detail: `host command exited successfully: ${execResult.command}`
        }
      : {
          status: "failed",
          detail: `host command failed with exit code ${execResult.exitCode}: ${execResult.command}`
        };
    trace(traceLog, "verification", `status=${verification.status} detail=${verification.detail}`);

    const assistantLines = [
      responseTextPrefix,
      `工作目录: ${execResult.workingDirectory}`,
      `命令: ${execResult.command}`,
      `退出码: ${execResult.exitCode}`
    ];
    if (execResult.stdout) {
      assistantLines.push("", "标准输出:", "```text", execResult.stdout, "```");
    }
    if (execResult.stderr) {
      assistantLines.push("", "标准错误:", "```text", execResult.stderr, "```");
    }

    const assistantMessage = this.deps.store.addMessage(
      conversationId,
      "assistant",
      assistantLines.join("\n"),
      buildAssistantMessageMetadata({
        input: {
          conversationId,
          mode,
          text: pendingAction.sourceRequestText,
          enableRetrievalForTurn: false
        },
        classification,
        snippets: [],
        toolResult: {
          toolName: "exec",
          summary: `exec ${pendingAction.command}`
        },
        pendingAction
      })
    );

    trace(traceLog, "persist", "state and audit written");
    const nextState = this.deps.store.upsertState({
      conversationId,
      retrievalUsed: false,
      toolsCalled: ["exec"],
      latestToolResult: `exec ${pendingAction.command}`,
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
      toolsUsed: ["exec"],
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
