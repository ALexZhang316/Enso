import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
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
        answer: `Mode: ${params.mode}. ${params.userText}\n\nNo API key configured, so this is a local draft response stub.`,
        riskNotes: params.classification.handlingClass === "action-adjacent" ? "Potential action intent detected." : "",
        evidenceReferences: params.evidence.map((snippet) => snippet.sourceName),
        needsConfirmation: params.classification.handlingClass === "action-adjacent",
        resultType: params.classification.handlingClass === "action-adjacent" ? "proposal" : "answer"
      };
    }

    const model = new ChatOpenAI({
      apiKey,
      model: params.config.provider.model,
      temperature: params.config.provider.temperature,
      configuration: {
        baseURL: params.config.provider.baseUrl
      }
    });

    const systemPrompt = [
      "You are Enso, a local-first desktop assistant.",
      "Follow the selected mode exactly. Do not auto-route to another mode.",
      "Output strictly valid JSON with keys:",
      "answer (string), riskNotes (string), evidenceReferences (string[]), needsConfirmation (boolean), resultType ('answer'|'proposal'|'dry_run')."
    ].join("\n");

    const historySummary = params.history
      .slice(-6)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    const evidenceSummary = params.evidence
      .map((snippet, index) => `[${index + 1}] ${snippet.sourceName}: ${snippet.content}`)
      .join("\n");

    const humanPrompt = [
      `Mode: ${params.mode}`,
      `Handling class: ${params.classification.handlingClass}`,
      `User request: ${params.userText}`,
      params.toolSummary ? `Tool summary: ${params.toolSummary}` : "Tool summary: none",
      evidenceSummary ? `Evidence:\n${evidenceSummary}` : "Evidence: none",
      historySummary ? `Recent history:\n${historySummary}` : "Recent history: none"
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
      answer: raw || "Unable to parse model output, returning fallback response.",
      riskNotes: "Model output was not structured JSON.",
      evidenceReferences: params.evidence.map((snippet) => snippet.sourceName),
      needsConfirmation: params.classification.handlingClass === "action-adjacent",
      resultType: params.classification.handlingClass === "action-adjacent" ? "proposal" : "answer"
    };
  }
}
