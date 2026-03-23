import { ProviderId } from "../../shared/providers";
import { extractTextFromParts, ensureBaseUrl, toNetworkError, toProviderError } from "./provider-http-utils";
import {
  ProviderError,
  ProviderMessage,
  TextGenerationProvider,
  TextGenerationRequest,
  TextGenerationResult
} from "./types";

interface OpenAiCompatibleProviderOptions {
  id: ProviderId;
  label: string;
  scriptedEnvPrefix?: string;
  prepareMessages?: (messages: ProviderMessage[]) => Array<{ role: string; content: string }>;
}

const scriptedResult = (providerLabel: string, envPrefix: string): TextGenerationResult | null => {
  const scriptedResponse = process.env[`ENSO_TEST_${envPrefix}_RESPONSE`];
  const scriptedError = process.env[`ENSO_TEST_${envPrefix}_ERROR`];

  if (scriptedError === "auth") {
    throw new ProviderError("auth", `${providerLabel} authentication failed in test mode.`);
  }
  if (scriptedError === "network") {
    throw new ProviderError("network", `${providerLabel} network failed in test mode.`);
  }
  if (scriptedError === "rate_limit") {
    throw new ProviderError("rate_limit", `${providerLabel} rate limit hit in test mode.`);
  }
  if (scriptedResponse) {
    return { text: scriptedResponse };
  }

  return null;
};

const extractAssistantText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }

  const firstChoice = choices[0] as { message?: { content?: unknown } } | undefined;
  return extractTextFromParts(firstChoice?.message?.content);
};

export class OpenAiCompatibleProvider implements TextGenerationProvider {
  readonly id: ProviderId;
  private readonly label: string;
  private readonly scriptedEnvPrefix: string;
  private readonly prepareMessages: (messages: ProviderMessage[]) => Array<{ role: string; content: string }>;

  constructor(options: OpenAiCompatibleProviderOptions) {
    this.id = options.id;
    this.label = options.label;
    this.scriptedEnvPrefix = options.scriptedEnvPrefix ?? options.id.toUpperCase();
    this.prepareMessages = options.prepareMessages ?? ((messages) => messages.map((message) => ({ ...message })));
  }

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const scripted = scriptedResult(this.label, this.scriptedEnvPrefix);
    if (scripted) {
      return scripted;
    }

    try {
      const response = await fetch(new URL("chat/completions", ensureBaseUrl(request.baseUrl)), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${request.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: request.model,
          messages: this.prepareMessages(request.messages),
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {})
        })
      });

      if (!response.ok) {
        throw await toProviderError(this.label, response);
      }

      const payload = (await response.json()) as unknown;
      const text = extractAssistantText(payload);
      if (!text) {
        throw new ProviderError("unknown", `${this.label} returned an empty response.`);
      }

      return { text };
    } catch (error) {
      throw toNetworkError(this.label, error);
    }
  }
}
