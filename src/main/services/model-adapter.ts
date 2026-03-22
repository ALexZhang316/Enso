import { PROVIDER_PRESET_MAP } from "../../shared/providers";
import { EnsoConfig, ChatMessage } from "../../shared/types";
import { createTextGenerationProvider } from "../providers/provider-factory";
import { ProviderError } from "../providers/types";
import { SecretService } from "./secret-service";

interface GenerateReplyParams {
  config: EnsoConfig;
  history: ChatMessage[];
  userText: string;
}

export class ModelAdapter {
  constructor(private readonly secretService: SecretService) {}

  async generateReply(params: GenerateReplyParams): Promise<string> {
    const { provider, baseUrl, model } = params.config.provider;
    const apiKey = this.secretService.getProviderApiKey(provider);

    if (!apiKey) {
      throw new ProviderError(
        "missing_api_key",
        `Please add a ${PROVIDER_PRESET_MAP[provider]?.label ?? provider} API key in Settings first.`
      );
    }

    const generationProvider = createTextGenerationProvider(provider);
    const recentMessages = params.history.slice(-12).map((message) => ({
      role: message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user",
      content: message.content
    })) as Array<{ role: "system" | "user" | "assistant"; content: string }>;

    const result = await generationProvider.generate({
      provider,
      baseUrl,
      model,
      apiKey,
      messages: [
        ...recentMessages,
        {
          role: "user",
          content: params.userText
        }
      ]
    });

    return result.text;
  }
}
