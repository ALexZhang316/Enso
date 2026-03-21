import { extractTextFromParts, ensureBaseUrl, toNetworkError, toProviderError } from "./provider-http-utils";
import { ProviderError, TextGenerationProvider, TextGenerationRequest, TextGenerationResult } from "./types";

const MAX_TOKENS = 1024;

const extractAssistantText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const content = (payload as { content?: unknown }).content;
  return extractTextFromParts(content);
};

export class AnthropicProvider implements TextGenerationProvider {
  readonly id = "anthropic" as const;

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const system = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content.trim())
      .filter(Boolean)
      .join("\n\n");
    const messages = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role,
        content: message.content
      }));

    try {
      const response = await fetch(new URL("messages", ensureBaseUrl(request.baseUrl)), {
        method: "POST",
        headers: {
          "x-api-key": request.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: MAX_TOKENS,
          ...(system ? { system } : {}),
          messages
        })
      });

      if (!response.ok) {
        throw await toProviderError("Anthropic", response);
      }

      const payload = (await response.json()) as unknown;
      const text = extractAssistantText(payload);
      if (!text) {
        throw new ProviderError("unknown", "Anthropic returned an empty response.");
      }

      return { text };
    } catch (error) {
      throw toNetworkError("Anthropic", error);
    }
  }
}
