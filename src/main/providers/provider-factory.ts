import { ProviderId } from "../../shared/providers";
import { AnthropicProvider } from "./anthropic-provider";
import { DeepSeekProvider } from "./deepseek-provider";
import { GeminiProvider } from "./gemini-provider";
import { KimiProvider } from "./kimi-provider";
import { OpenAIProvider } from "./openai-provider";
import { ProviderError, TextGenerationProvider } from "./types";

const anthropicProvider = new AnthropicProvider();
const deepSeekProvider = new DeepSeekProvider();
const geminiProvider = new GeminiProvider();
const kimiProvider = new KimiProvider();
const openAIProvider = new OpenAIProvider();

export const createTextGenerationProvider = (providerId: ProviderId): TextGenerationProvider => {
  if (providerId === "kimi") {
    return kimiProvider;
  }
  if (providerId === "openai") {
    return openAIProvider;
  }
  if (providerId === "deepseek") {
    return deepSeekProvider;
  }
  if (providerId === "anthropic") {
    return anthropicProvider;
  }
  if (providerId === "gemini") {
    return geminiProvider;
  }

  throw new ProviderError("invalid_request", `Current build does not implement provider: ${providerId}`);
};
