import { ModeId } from "../../shared/modes";
import {
  ChatMessage,
  EnsoConfig,
  RequestClassification,
  RetrievedSnippet
} from "../../shared/types";

export interface DraftResponse {
  answer: string;
  riskNotes: string;
  evidenceReferences: string[];
  needsConfirmation: boolean;
  resultType: "answer" | "proposal" | "dry_run";
}

interface GenerateDraftParams {
  mode: ModeId;
  userText: string;
  history: ChatMessage[];
  evidence: RetrievedSnippet[];
  toolSummary: string;
  classification: RequestClassification;
  config: EnsoConfig;
}

const modeLabelMap: Record<ModeId, string> = {
  "deep-dialogue": "深度对话",
  decision: "决策",
  research: "研究"
};

const loadLangChainDeps = async (): Promise<{
  ChatOpenAI: (typeof import("@langchain/openai"))["ChatOpenAI"];
  HumanMessage: (typeof import("@langchain/core/messages"))["HumanMessage"];
  SystemMessage: (typeof import("@langchain/core/messages"))["SystemMessage"];
}> => {
  const [{ ChatOpenAI }, { HumanMessage, SystemMessage }] = await Promise.all([
    import("@langchain/openai"),
    import("@langchain/core/messages")
  ]);

  return { ChatOpenAI, HumanMessage, SystemMessage };
};

const stringifyContent = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object" && "text" in item) {
          const typed = item as { text?: unknown };
          return typeof typed.text === "string" ? typed.text : "";
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
};

const parseDraft = (rawText: string): DraftResponse | null => {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]) as Partial<DraftResponse>;
    if (!parsed.answer || !parsed.resultType) {
      return null;
    }

    return {
      answer: parsed.answer,
      riskNotes: parsed.riskNotes ?? "",
      evidenceReferences: Array.isArray(parsed.evidenceReferences)
        ? parsed.evidenceReferences.filter((entry): entry is string => typeof entry === "string")
        : [],
      needsConfirmation: Boolean(parsed.needsConfirmation),
      resultType: parsed.resultType
    };
  } catch {
    return null;
  }
};

export class ModelAdapter {
  async generateDraft(params: GenerateDraftParams): Promise<DraftResponse> {
    const apiKey = process.env[params.config.provider.apiKeyEnv];

    if (!apiKey) {
      return {
        answer: `当前模式：${modeLabelMap[params.mode]}\n\n你的请求：${params.userText}\n\n未检测到 API Key，以下为本地草稿响应（Stub）。`,
        riskNotes: params.classification.handlingClass === "action-adjacent" ? "检测到潜在动作意图。" : "",
        evidenceReferences: params.evidence.map((snippet) => snippet.sourceName),
        needsConfirmation: params.classification.handlingClass === "action-adjacent",
        resultType: params.classification.handlingClass === "action-adjacent" ? "proposal" : "answer"
      };
    }

    const { ChatOpenAI, HumanMessage, SystemMessage } = await loadLangChainDeps();

    const model = new ChatOpenAI({
      apiKey,
      model: params.config.provider.model,
      temperature: params.config.provider.temperature,
      configuration: {
        baseURL: params.config.provider.baseUrl
      }
    });

    const systemPrompt = [
      "你是 Enso，本地优先的桌面个人助手。",
      "必须严格遵循用户手动选择的模式，不得自动切换模式。",
      "默认使用简体中文回答，除非用户明确要求其他语言。",
      "仅输出严格合法的 JSON，字段必须是：",
      "answer (string), riskNotes (string), evidenceReferences (string[]), needsConfirmation (boolean), resultType ('answer'|'proposal'|'dry_run')."
    ].join("\n");

    const historySummary = params.history
      .slice(-6)
      .map((message) => {
        const roleLabel =
          message.role === "user" ? "用户" : message.role === "assistant" ? "助手" : "系统";
        return `${roleLabel}: ${message.content}`;
      })
      .join("\n");

    const evidenceSummary = params.evidence
      .map((snippet, index) => `[${index + 1}] ${snippet.sourceName}: ${snippet.content}`)
      .join("\n");

    const humanPrompt = [
      `模式：${modeLabelMap[params.mode]}`,
      `处理分类：${params.classification.handlingClass}`,
      `用户请求：${params.userText}`,
      params.toolSummary ? `工具摘要：${params.toolSummary}` : "工具摘要：无",
      evidenceSummary ? `证据：\n${evidenceSummary}` : "证据：无",
      historySummary ? `最近对话：\n${historySummary}` : "最近对话：无"
    ].join("\n\n");

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ]);

    const raw = stringifyContent(response.content);
    const parsed = parseDraft(raw);

    if (parsed) {
      return parsed;
    }

    return {
      answer: raw || "模型输出解析失败，已返回兜底响应。",
      riskNotes: "模型输出不是结构化 JSON。",
      evidenceReferences: params.evidence.map((snippet) => snippet.sourceName),
      needsConfirmation: params.classification.handlingClass === "action-adjacent",
      resultType: params.classification.handlingClass === "action-adjacent" ? "proposal" : "answer"
    };
  }
}

