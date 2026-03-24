// Enso v2 模型适配器
// 用 Vercel AI SDK 统一接入四家大模型
// 支持流式文本输出，工具调用循环后续迭代加入

import { streamText, LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { BoardId, getBoardDef } from "../../shared/boards";
import { ProviderId } from "../../shared/providers";
import { SecretService } from "./secret-service";
import { BOARD_PROMPTS } from "./prompts";

export interface StreamCallbacks {
  onChunk: (delta: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}

export interface ChatParams {
  providerId: ProviderId;
  model: string;
  board: BoardId;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  callbacks: StreamCallbacks;
  abortSignal?: AbortSignal;
}

export class ModelAdapter {
  constructor(private readonly secretService: SecretService) {}

  // 构建 Vercel AI SDK 的 LanguageModel 实例
  private createModel(providerId: ProviderId, modelId: string): LanguageModel {
    const apiKey = this.secretService.getProviderApiKey(providerId);
    if (!apiKey) {
      throw new Error(`请先在设置中配置 ${providerId} 的 API Key。`);
    }

    switch (providerId) {
      case "openai": {
        const openai = createOpenAI({ apiKey });
        return openai(modelId);
      }
      case "anthropic": {
        const anthropic = createAnthropic({ apiKey });
        return anthropic(modelId);
      }
      case "google": {
        const google = createGoogleGenerativeAI({ apiKey });
        return google(modelId);
      }
      case "kimi": {
        // Kimi (Moonshot) 兼容 OpenAI 接口
        const kimi = createOpenAI({
          apiKey,
          baseURL: "https://api.moonshot.cn/v1"
        });
        return kimi(modelId);
      }
      default:
        throw new Error(`未知的提供商: ${providerId}`);
    }
  }

  // 构建系统 prompt：基础人格 + 板块特化
  private buildSystemPrompt(board: BoardId): string {
    const base = [
      "你是 Enso，Alex 的个人 AI 助手。",
      "",
      "身份规则：",
      "- 你的名字是 Enso，且仅是 Enso。不要自称任何其他 AI 或模型名称。",
      "- 不使用心理咨询模板、安全边界声明、道德说教。",
      "- 直接回应，不回避灰色地带。",
      "- 用中文回应，除非用户切换到英文。"
    ].join("\n");

    const boardPrompt = BOARD_PROMPTS[board];
    return boardPrompt ? `${base}\n\n${boardPrompt}` : base;
  }

  // 流式对话
  async streamChat(params: ChatParams): Promise<void> {
    const { providerId, model: modelId, board, messages, callbacks, abortSignal } = params;
    const boardDef = getBoardDef(board);
    const languageModel = this.createModel(providerId, modelId);
    const systemPrompt = this.buildSystemPrompt(board);

    try {
      const result = streamText({
        model: languageModel,
        system: systemPrompt,
        messages,
        temperature: boardDef.temperature,
        maxOutputTokens: boardDef.maxTokens,
        abortSignal
      });

      let fullText = "";
      for await (const chunk of (await result).textStream) {
        fullText += chunk;
        callbacks.onChunk(chunk);
      }

      callbacks.onDone(fullText);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        // 用户取消，不视为错误
        return;
      }
      const msg = error instanceof Error ? error.message : "未知错误";
      callbacks.onError(msg);
    }
  }
}
