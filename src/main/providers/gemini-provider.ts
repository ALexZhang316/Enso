import { extractTextFromParts, ensureBaseUrl, toNetworkError, toProviderError } from "./provider-http-utils";
import { ProviderError, TextGenerationProvider, TextGenerationRequest, TextGenerationResult } from "./types";

const buildBody = (request: TextGenerationRequest): Record<string, unknown> => {
  const systemInstruction = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
  const contents = request.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    }));

  return {
    ...(systemInstruction
      ? {
          system_instruction: {
            parts: [{ text: systemInstruction }]
          }
        }
      : {}),
    contents
  };
};

const extractAssistantText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return "";
  }

  const firstCandidate = candidates[0] as { content?: { parts?: unknown } } | undefined;
  return extractTextFromParts(firstCandidate?.content?.parts);
};

export class GeminiProvider implements TextGenerationProvider {
  readonly id = "gemini" as const;

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    try {
      const response = await fetch(
        new URL(`models/${encodeURIComponent(request.model)}:generateContent`, ensureBaseUrl(request.baseUrl)),
        {
          method: "POST",
          headers: {
            "x-goog-api-key": request.apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(buildBody(request))
        }
      );

      if (!response.ok) {
        throw await toProviderError("Gemini", response);
      }

      const payload = (await response.json()) as unknown;
      const text = extractAssistantText(payload);
      if (!text) {
        throw new ProviderError("unknown", "Gemini returned an empty response.");
      }

      return { text };
    } catch (error) {
      throw toNetworkError("Gemini", error);
    }
  }
}
