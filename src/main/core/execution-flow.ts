import { ModeId } from "../../shared/modes";
import {
  AuditSummary,
  ExecutionInput,
  ExecutionResult,
  RequestClassification,
  RetrievedSnippet,
  StateSnapshot
} from "../../shared/types";
import { ConfigService } from "../services/config-service";
import { KnowledgeService } from "../services/knowledge-service";
import { DraftResponse, ModelAdapter } from "../services/model-adapter";
import { EnsoStore } from "../services/store";
import { ToolRunResult, ToolService } from "../services/tool-service";

interface ExecutionFlowDependencies {
  store: EnsoStore;
  configService: ConfigService;
  knowledgeService: KnowledgeService;
  toolService: ToolService;
  modelAdapter: ModelAdapter;
}

const actionIntentPatternEn = /\b(write|delete|remove|send|execute|publish|transfer|deploy|modify|update)\b/i;
const actionIntentPatternZh = /(写入|删除|移除|发送|执行|发布|转账|部署|修改|更新)/;
const retrievalHintPatternEn =
  /\b(file|document|source|citation|evidence|from notes|knowledge base|according to)\b/i;
const retrievalHintPatternZh = /(文件|文档|来源|引用|证据|根据笔记|知识库|根据资料)/;
const toolHintPatternEn = /\b(read|search|find|calculate|compute|sum|average|multiply|divide)\b/i;
const toolHintPatternZh = /(读取|搜索|查找|计算|求和|平均|乘|除)/;

const hasActionIntent = (text: string): boolean =>
  actionIntentPatternEn.test(text) || actionIntentPatternZh.test(text);

const hasRetrievalHint = (text: string): boolean =>
  retrievalHintPatternEn.test(text) || retrievalHintPatternZh.test(text);

const hasToolHint = (text: string): boolean =>
  toolHintPatternEn.test(text) || toolHintPatternZh.test(text);

const classifyRequest = (params: {
  text: string;
  mode: ModeId;
  enableRetrievalForTurn: boolean;
  retrievalDefaultForMode: boolean;
}): RequestClassification => {
  const actionAdjacent = hasActionIntent(params.text);
  const retrievalHint = hasRetrievalHint(params.text);
  const toolHint = hasToolHint(params.text);

  const retrievalNeeded =
    params.enableRetrievalForTurn || retrievalHint || (params.mode === "research" && params.retrievalDefaultForMode);

  const toolNeeded = toolHint;

  let handlingClass: RequestClassification["handlingClass"] = "pure-dialogue";
  if (actionAdjacent) {
    handlingClass = "action-adjacent";
  } else if (toolNeeded) {
    handlingClass = "tool-assisted";
  } else if (retrievalNeeded) {
    handlingClass = "retrieval-enhanced";
  }

  return {
    handlingClass,
    retrievalNeeded,
    toolNeeded
  };
};

const shapeFinalResponse = (params: {
  draft: DraftResponse;
  style: "direct" | "balanced";
  riskLabeling: "always" | "balanced-only" | "off";
  gateApplied: boolean;
  toolResult: ToolRunResult | null;
  snippets: RetrievedSnippet[];
}): { text: string; resultType: AuditSummary["resultType"]; riskNotes: string } => {
  const sections: string[] = [];

  if (params.gateApplied) {
    sections.push("检测到动作型请求。受 MVP 只读约束限制，本结果仅作为提案。");
  }

  sections.push(params.draft.answer);

  if (params.toolResult) {
    sections.push(`工具摘要：${params.toolResult.summary}`);
  }

  if (params.snippets.length > 0) {
    const sources = [...new Set(params.snippets.map((snippet) => snippet.sourceName))].join(", ");
    sections.push(`检索证据来源：${sources}`);
  }

  const shouldRenderRiskNotes =
    params.riskLabeling === "always" ||
    (params.riskLabeling === "balanced-only" && params.style === "balanced");

  if (shouldRenderRiskNotes && params.draft.riskNotes) {
    sections.push(`风险提示：${params.draft.riskNotes}`);
  }

  const resultType: AuditSummary["resultType"] = params.gateApplied
    ? "proposal"
    : params.draft.resultType;

  return {
    text: sections.join("\n\n").trim(),
    resultType,
    riskNotes: params.gateApplied
      ? params.draft.riskNotes || "已应用只读门控。"
      : params.draft.riskNotes
  };
};

export class ExecutionFlow {
  constructor(private readonly deps: ExecutionFlowDependencies) {}

  async run(input: ExecutionInput): Promise<ExecutionResult> {
    // Step 2: Read local execution context first.
    const conversation = this.deps.store.getConversation(input.conversationId);
    if (!conversation) {
      throw new Error("未找到当前会话。");
    }

    this.deps.store.setConversationMode(input.conversationId, input.mode);

    const config = this.deps.configService.load();
    const priorState = this.deps.store.getState(input.conversationId);
    const history = this.deps.store.listRecentMessages(input.conversationId, 12);

    // Step 3: Parse request handling class.
    const classification = classifyRequest({
      text: input.text,
      mode: input.mode,
      enableRetrievalForTurn: input.enableRetrievalForTurn,
      retrievalDefaultForMode: config.modeDefaults.retrievalByMode[input.mode]
    });

    // Step 4: Retrieval decision.
    const retrievedSnippets = classification.retrievalNeeded
      ? this.deps.knowledgeService.retrieve(input.text, 5)
      : [];

    // Step 5: Tool decision.
    const toolResult = classification.toolNeeded
      ? this.deps.toolService.decideAndRun(input.text, retrievedSnippets)
      : null;

    // Step 6 and 7: Context assembly and model draft generation.
    const draft = await this.deps.modelAdapter.generateDraft({
      mode: input.mode,
      userText: input.text,
      history,
      evidence: retrievedSnippets,
      toolSummary: toolResult?.summary ?? "",
      classification,
      config
    });

    // Step 8: Gate check for read-only default.
    const gateApplied =
      config.permissions.readOnlyDefault &&
      (draft.needsConfirmation ||
        classification.handlingClass === "action-adjacent" ||
        hasActionIntent(input.text));

    // Step 9: Final response shaping.
    const shaped = shapeFinalResponse({
      draft,
      style: config.expression.style,
      riskLabeling: config.expression.riskLabeling,
      gateApplied,
      toolResult,
      snippets: retrievedSnippets
    });

    // Step 10: Persistence and audit writeback.
    this.deps.store.addMessage(input.conversationId, "user", input.text, {
      mode: input.mode,
      handlingClass: classification.handlingClass,
      retrievalEnabled: classification.retrievalNeeded
    });

    const assistantMessage = this.deps.store.addMessage(input.conversationId, "assistant", shaped.text, {
      mode: input.mode,
      handlingClass: classification.handlingClass,
      retrievalUsed: retrievedSnippets.length > 0,
      toolName: toolResult?.toolName ?? null,
      retrievedSnippets: retrievedSnippets.map((snippet) => ({
        sourceName: snippet.sourceName,
        sourcePath: snippet.sourcePath,
        content: snippet.content.slice(0, 220),
        score: snippet.score
      }))
    });

    const nextState: StateSnapshot = this.deps.store.upsertState({
      conversationId: input.conversationId,
      retrievalUsed: retrievedSnippets.length > 0,
      toolsCalled: toolResult ? [toolResult.toolName] : [],
      latestToolResult: toolResult?.summary ?? priorState.latestToolResult,
      pendingConfirmation: gateApplied,
      taskStatus: gateApplied ? "awaiting_confirmation" : "completed",
      updatedAt: new Date().toISOString()
    });

    const audit = this.deps.store.addAudit({
      conversationId: input.conversationId,
      mode: input.mode,
      retrievalUsed: retrievedSnippets.length > 0,
      toolsUsed: toolResult ? [toolResult.toolName] : [],
      resultType: shaped.resultType,
      riskNotes: shaped.riskNotes
    });

    return {
      assistantMessage,
      state: nextState,
      audit,
      classification,
      retrievedSnippets
    };
  }
}
