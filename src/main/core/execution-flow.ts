import { ModeId } from "../../shared/modes";
import {
  AuditSummary,
  ExecutionInput,
  ExecutionResult,
  RequestClassification,
  StateSnapshot
} from "../../shared/types";
import { ConfigService } from "../services/config-service";
import { KnowledgeService } from "../services/knowledge-service";
import { ModelAdapter } from "../services/model-adapter";
import { EnsoStore } from "../services/store";
import { ToolService } from "../services/tool-service";

interface ExecutionFlowDependencies {
  store: EnsoStore;
  configService: ConfigService;
  knowledgeService: KnowledgeService;
  toolService: ToolService;
  modelAdapter: ModelAdapter;
}

const actionIntentPatternEn = /\b(write|delete|remove|send|execute|publish|transfer|deploy|modify|update)\b/i;
const actionIntentPatternZh = /(写入|删除|移除|发送|执行|发布|转账|部署|修改|更新)/;

const hasActionIntent = (text: string): boolean =>
  actionIntentPatternEn.test(text) || actionIntentPatternZh.test(text);

const classifyRequest = (text: string): RequestClassification => {
  if (hasActionIntent(text)) {
    return {
      handlingClass: "action-adjacent",
      retrievalNeeded: false,
      toolNeeded: false
    };
  }

  return {
    handlingClass: "pure-dialogue",
    retrievalNeeded: false,
    toolNeeded: false
  };
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
    const priorState = this.deps.store.getState(input.conversationId);
    const history = this.deps.store.listRecentMessages(input.conversationId, 12);
    const classification = classifyRequest(input.text);
    const retrievedSnippets = input.enableRetrievalForTurn
      ? this.deps.knowledgeService.retrieve(input.text, 5)
      : [];
    const toolResult = this.deps.toolService.decideAndRun(input.text, retrievedSnippets);
    const retrievalUsed = retrievedSnippets.length > 0;
    const handlingClass: RequestClassification["handlingClass"] =
      classification.handlingClass === "action-adjacent"
        ? "action-adjacent"
        : toolResult
          ? "tool-assisted"
          : retrievalUsed
            ? "retrieval-enhanced"
            : classification.handlingClass;

    this.deps.store.addMessage(input.conversationId, "user", input.text, {
      mode: input.mode,
      handlingClass,
      retrievalEnabled: input.enableRetrievalForTurn
    });

    if (classification.handlingClass === "action-adjacent" && config.permissions.readOnlyDefault) {
      const proposalText = "检测到动作型请求。当前 MVP-1 仅支持基础文本对话，不执行动作请求。";
      const assistantMessage = this.deps.store.addMessage(input.conversationId, "assistant", proposalText, {
        mode: input.mode,
        handlingClass,
        retrievalUsed,
        toolName: toolResult?.toolName ?? null
      });

      const nextState: StateSnapshot = this.deps.store.upsertState({
        conversationId: input.conversationId,
        retrievalUsed,
        toolsCalled: toolResult ? [toolResult.toolName] : [],
        latestToolResult: priorState.latestToolResult,
        pendingConfirmation: true,
        taskStatus: "awaiting_confirmation",
        updatedAt: new Date().toISOString()
      });

      const audit = this.deps.store.addAudit({
        conversationId: input.conversationId,
        mode: input.mode,
        retrievalUsed,
        toolsUsed: toolResult ? [toolResult.toolName] : [],
        resultType: "proposal",
        riskNotes: "动作型请求被只读门控拦截。"
      });

      return {
        assistantMessage,
        state: nextState,
        audit,
        classification: {
          ...classification,
          handlingClass,
          retrievalNeeded: input.enableRetrievalForTurn,
          toolNeeded: Boolean(toolResult)
        },
        retrievedSnippets
      };
    }

    try {
      const retrievalContext = retrievalUsed
        ? `\n\n已检索到本地知识片段（仅供参考）：\n${retrievedSnippets
            .map((item, index) => `${index + 1}. [${item.sourceName}] ${item.content}`)
            .join("\n")}`
        : "";
      const toolContext = toolResult ? `\n\n工具结果：${toolResult.summary}` : "";
      const replyText = await this.deps.modelAdapter.generateReply({
        config,
        history,
        userText: `${input.text}${retrievalContext}${toolContext}`
      });

      const assistantMessage = this.deps.store.addMessage(input.conversationId, "assistant", replyText, {
        mode: input.mode,
        handlingClass,
        retrievalUsed,
        toolName: toolResult?.toolName ?? null,
        retrievedSnippets
      });

      const nextState: StateSnapshot = this.deps.store.upsertState({
        conversationId: input.conversationId,
        retrievalUsed,
        toolsCalled: toolResult ? [toolResult.toolName] : [],
        latestToolResult: toolResult?.summary ?? "",
        pendingConfirmation: false,
        taskStatus: "completed",
        updatedAt: new Date().toISOString()
      });

      const audit = this.deps.store.addAudit({
        conversationId: input.conversationId,
        mode: input.mode,
        retrievalUsed,
        toolsUsed: toolResult ? [toolResult.toolName] : [],
        resultType: "answer",
        riskNotes: ""
      });

      return {
        assistantMessage,
        state: nextState,
        audit,
        classification: {
          ...classification,
          handlingClass,
          retrievalNeeded: input.enableRetrievalForTurn,
          toolNeeded: Boolean(toolResult)
        },
        retrievedSnippets
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "模型调用失败。";
      const assistantMessage = this.deps.store.addMessage(
        input.conversationId,
        "assistant",
        `本次请求失败：${errorMessage}`,
        {
          mode: input.mode,
          handlingClass,
          retrievalUsed,
          toolName: toolResult?.toolName ?? null,
          providerError: true
        }
      );

      const nextState = this.deps.store.upsertState({
        conversationId: input.conversationId,
        retrievalUsed,
        toolsCalled: toolResult ? [toolResult.toolName] : [],
        latestToolResult: toolResult?.summary ?? "",
        pendingConfirmation: false,
        taskStatus: "completed",
        updatedAt: new Date().toISOString()
      });

      const audit = this.deps.store.addAudit({
        conversationId: input.conversationId,
        mode: input.mode,
        retrievalUsed,
        toolsUsed: toolResult ? [toolResult.toolName] : [],
        resultType: "answer",
        riskNotes: errorMessage
      });

      return {
        assistantMessage,
        state: nextState,
        audit,
        classification: {
          ...classification,
          handlingClass,
          retrievalNeeded: input.enableRetrievalForTurn,
          toolNeeded: Boolean(toolResult)
        },
        retrievedSnippets
      };
    }
  }
}
