import { ModeId } from "../../shared/modes";
import {
  AuditSummary,
  ExecutionInput,
  ExecutionPlan,
  ExecutionResult,
  RequestClassification,
  RetrievedSnippet,
  StateSnapshot,
  TraceEntry,
  VerificationResult,
  VerificationStatus
} from "../../shared/types";
import { ConfigService } from "../services/config-service";
import { KnowledgeService } from "../services/knowledge-service";
import { ModelAdapter } from "../services/model-adapter";
import { EnsoStore } from "../services/store";
import { ToolService, ToolRunResult } from "../services/tool-service";

interface ExecutionFlowDependencies {
  store: EnsoStore;
  configService: ConfigService;
  knowledgeService: KnowledgeService;
  toolService: ToolService;
  modelAdapter: ModelAdapter;
}

// --- request classification ---

const actionIntentPatternEn = /\b(write|delete|remove|send|execute|publish|transfer|deploy|modify|update)\b/i;
const actionIntentPatternZh = /(写入|删除|移除|发送|执行|发布|转账|部署|修改|更新)/;

const retrievalHintEn = /\b(search|find|look\s?up|retrieve|evidence|document|quote|source|reference|knowledge)\b/i;
const retrievalHintZh = /(搜索|查找|检索|查阅|引用|知识|来源|文档|证据)/;

const toolHintEn = /\b(calculate|compute|sum|average|multiply|divide|read\s?file|read)\b/i;
const toolHintZh = /(计算|求和|平均|乘|除|读取|阅读)/;

const hasActionIntent = (text: string): boolean =>
  actionIntentPatternEn.test(text) || actionIntentPatternZh.test(text);

const hasRetrievalHint = (text: string): boolean =>
  retrievalHintEn.test(text) || retrievalHintZh.test(text);

const hasToolHint = (text: string): boolean =>
  toolHintEn.test(text) || toolHintZh.test(text);

const modeRetrievalBias: Record<ModeId, boolean> = {
  default: false,
  "deep-dialogue": false,
  decision: true,
  research: true
};

const classifyRequest = (text: string, mode: ModeId, hasKnowledge: boolean): RequestClassification => {
  if (hasActionIntent(text)) {
    return { handlingClass: "action-adjacent", retrievalNeeded: false, toolNeeded: false };
  }

  const retrievalNeeded = hasKnowledge && (hasRetrievalHint(text) || modeRetrievalBias[mode]);
  const toolNeeded = hasToolHint(text);

  if (toolNeeded) {
    return { handlingClass: "tool-assisted", retrievalNeeded, toolNeeded: true };
  }
  if (retrievalNeeded) {
    return { handlingClass: "retrieval-enhanced", retrievalNeeded: true, toolNeeded: false };
  }

  return { handlingClass: "pure-dialogue", retrievalNeeded: false, toolNeeded: false };
};

// --- helpers ---

const ts = (): string => new Date().toISOString();

const trace = (entries: TraceEntry[], phase: TraceEntry["phase"], summary: string): void => {
  entries.push({ phase, summary, timestamp: ts() });
};

const buildPlan = (
  classification: RequestClassification,
  text: string
): ExecutionPlan | null => {
  if (classification.handlingClass === "pure-dialogue") return null;

  const steps: string[] = [];
  const likelyTools: string[] = [];
  let verificationTarget = "response coherence";

  if (classification.handlingClass === "action-adjacent") {
    steps.push("detect action intent", "convert to proposal", "block execution");
    verificationTarget = "gate blocked";
    return { goal: "gate action request", steps, likelyTools: [], verificationTarget };
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
    return { status: "blocked", detail: "action request blocked by read-only gate" };
  }

  if (classification.handlingClass === "pure-dialogue") {
    if (replyText && replyText.length > 0) {
      return { status: "passed", detail: "model produced a reply" };
    }
    return { status: "failed", detail: "model returned empty reply" };
  }

  const checks: Array<{ ok: boolean; label: string }> = [];

  if (classification.retrievalNeeded) {
    checks.push({ ok: snippets.length > 0, label: "retrieval returned snippets" });
  }
  if (classification.toolNeeded) {
    checks.push({ ok: toolResult !== null, label: "tool produced a result" });
  }
  checks.push({ ok: replyText.length > 0, label: "model produced a reply" });

  const failed = checks.filter((c) => !c.ok);
  if (failed.length === 0) {
    return { status: "passed", detail: checks.map((c) => c.label).join("; ") };
  }

  const status: VerificationStatus = failed.length === checks.length ? "failed" : "passed";
  const detail = checks.map((c) => `${c.ok ? "[ok]" : "[fail]"} ${c.label}`).join("; ");
  return { status, detail };
};

// --- main flow ---

export class ExecutionFlow {
  constructor(private readonly deps: ExecutionFlowDependencies) {}

  async run(input: ExecutionInput): Promise<ExecutionResult> {
    const conversation = this.deps.store.getConversation(input.conversationId);
    if (!conversation) {
      throw new Error("未找到当前会话。");
    }

    this.deps.store.setConversationMode(input.conversationId, input.mode);

    const config = this.deps.configService.load();
    const priorState = this.deps.store.getState(input.conversationId);
    const history = this.deps.store.listRecentMessages(input.conversationId, 12);
    const traceLog: TraceEntry[] = [];

    // Phase 2 - classify
    const knowledgeSources = this.deps.store.listKnowledgeSources();
    const hasKnowledge = knowledgeSources.length > 0;
    const classification = classifyRequest(input.text, input.mode, hasKnowledge);
    trace(traceLog, "classify", `class=${classification.handlingClass} retrieval=${classification.retrievalNeeded} tool=${classification.toolNeeded}`);

    // store user message
    this.deps.store.addMessage(input.conversationId, "user", input.text, {
      mode: input.mode,
      handlingClass: classification.handlingClass,
      retrievalEnabled: classification.retrievalNeeded
    });

    // Phase 3 - plan
    const plan = buildPlan(classification, input.text);
    if (plan) {
      trace(traceLog, "plan", `goal=${plan.goal} steps=${plan.steps.length}`);
    }

    // Phase 10 - gate check (action-adjacent)
    if (classification.handlingClass === "action-adjacent" && config.permissions.readOnlyDefault) {
      trace(traceLog, "gate", "action request blocked by read-only default");

      const proposalText = "检测到动作型请求。当前仅支持只读操作，动作请求已转为提案记录，未执行任何外部操作。";
      const assistantMessage = this.deps.store.addMessage(input.conversationId, "assistant", proposalText, {
        mode: input.mode,
        handlingClass: classification.handlingClass,
        retrievalUsed: false,
        toolName: null
      });

      const verification = verify(classification, [], null, proposalText);
      trace(traceLog, "verification", `status=${verification.status}`);
      trace(traceLog, "persist", "state and audit written");

      const nextState = this.deps.store.upsertState({
        conversationId: input.conversationId,
        retrievalUsed: false,
        toolsCalled: [],
        latestToolResult: priorState.latestToolResult,
        pendingConfirmation: true,
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
        toolsUsed: [],
        resultType: "proposal",
        riskNotes: "动作型请求被只读门控拦截。"
      });

      return { assistantMessage, state: nextState, audit, classification, retrievedSnippets: [], plan, trace: traceLog, verification };
    }

    // Phase 4 - retrieval
    let snippets: RetrievedSnippet[] = [];
    if (classification.retrievalNeeded) {
      snippets = this.deps.knowledgeService.retrieve(input.text, 5);
      trace(traceLog, "retrieval", `returned ${snippets.length} snippets`);
    }

    // Phase 5 - tool decision
    let toolResult: ToolRunResult | null = null;
    if (classification.toolNeeded) {
      toolResult = this.deps.toolService.decideAndRun(input.text, snippets);
      trace(traceLog, "tool", toolResult ? `tool=${toolResult.toolName} summary=${toolResult.summary}` : "no tool matched");
    }

    // Phase 6+7+8 - context assembly + model call
    try {
      const contextParts: string[] = [];

      if (snippets.length > 0) {
        const evidenceBlock = snippets
          .map((s, i) => `[证据${i + 1}] (${s.sourceName})\n${s.content}`)
          .join("\n\n");
        contextParts.push(`以下是从本地知识库检索到的相关证据:\n\n${evidenceBlock}`);
      }

      if (toolResult) {
        contextParts.push(`工具执行结果 [${toolResult.toolName}]: ${toolResult.summary}`);
      }

      const enrichedUserText = contextParts.length > 0
        ? `${contextParts.join("\n\n")}\n\n用户问题: ${input.text}`
        : input.text;

      trace(traceLog, "model", "calling model with assembled context");

      const replyText = await this.deps.modelAdapter.generateReply({
        config,
        history,
        userText: enrichedUserText
      });

      // Phase 9 - verification
      const verification = verify(classification, snippets, toolResult, replyText);
      trace(traceLog, "verification", `status=${verification.status} detail=${verification.detail}`);

      // Build metadata for the assistant message
      const msgMeta: Record<string, unknown> = {
        mode: input.mode,
        handlingClass: classification.handlingClass,
        retrievalUsed: snippets.length > 0,
        toolName: toolResult?.toolName ?? null
      };
      if (toolResult) {
        msgMeta.toolSummary = toolResult.summary;
      }
      if (snippets.length > 0) {
        msgMeta.retrievalSnippetCount = snippets.length;
        msgMeta.retrievalSources = [...new Set(snippets.map((s) => s.sourceName))];
      }

      const assistantMessage = this.deps.store.addMessage(input.conversationId, "assistant", replyText, msgMeta);

      trace(traceLog, "persist", "state and audit written");

      const nextState = this.deps.store.upsertState({
        conversationId: input.conversationId,
        retrievalUsed: snippets.length > 0,
        toolsCalled: toolResult ? [toolResult.toolName] : [],
        latestToolResult: toolResult?.summary ?? "",
        pendingConfirmation: false,
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

      return { assistantMessage, state: nextState, audit, classification, retrievedSnippets: snippets, plan, trace: traceLog, verification };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "模型调用失败。";
      trace(traceLog, "model", `error: ${errorMessage}`);

      const verification: VerificationResult = { status: "failed", detail: errorMessage };
      trace(traceLog, "verification", `status=failed detail=${errorMessage}`);

      const assistantMessage = this.deps.store.addMessage(
        input.conversationId,
        "assistant",
        `本次请求失败：${errorMessage}`,
        {
          mode: input.mode,
          handlingClass: classification.handlingClass,
          retrievalUsed: snippets.length > 0,
          toolName: toolResult?.toolName ?? null,
          providerError: true
        }
      );

      trace(traceLog, "persist", "error state written");

      const nextState = this.deps.store.upsertState({
        conversationId: input.conversationId,
        retrievalUsed: snippets.length > 0,
        toolsCalled: toolResult ? [toolResult.toolName] : [],
        latestToolResult: toolResult?.summary ?? "",
        pendingConfirmation: false,
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

      return { assistantMessage, state: nextState, audit, classification, retrievedSnippets: snippets, plan, trace: traceLog, verification };
    }
  }
}
