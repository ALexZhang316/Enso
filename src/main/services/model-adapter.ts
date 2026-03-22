import { PROVIDER_PRESET_MAP } from "../../shared/providers";
import { ChatMessage, EnsoConfig, ModelExpressionConfig } from "../../shared/types";
import { createTextGenerationProvider } from "../providers/provider-factory";
import { ProviderError } from "../providers/types";
import { SecretService } from "./secret-service";

type ModelResponseMode = "plain-text" | "structured-draft";

interface GenerateReplyParams {
  config: EnsoConfig;
  history: ChatMessage[];
  userText: string;
  expression: ModelExpressionConfig;
  responseMode?: ModelResponseMode;
}

const densityInstructions: Record<ModelExpressionConfig["density"], string> = {
  concise: "Keep the answer concise and avoid unnecessary filler.",
  standard: "Use a balanced amount of detail with clear, direct phrasing.",
  detailed: "Provide a detailed response with enough context to make the result self-contained."
};

const buildSystemPrompt = (expression: ModelExpressionConfig, responseMode: ModelResponseMode): string => {
  const parts = [
    "You are Enso, a local-first Windows desktop agent. Stay grounded in the provided context, evidence, and tool output.",
    `Expression config: density=${expression.density}; structuredFirst=${expression.structuredFirst}; reportingGranularity=${expression.reportingGranularity}.`,
    densityInstructions[expression.density],
    expression.structuredFirst
      ? "Prefer structured output before prose when it materially improves clarity."
      : "Prefer direct prose unless structure is clearly helpful.",
    expression.reportingGranularity === "plan-level"
      ? "Keep the response at plan level unless concrete result details are required."
      : "Prioritize concrete result details over extra planning narration."
  ];

  if (responseMode === "structured-draft") {
    parts.push(
      "Return only valid JSON with exactly these keys: answer, riskNotes, evidenceRefs, plannedTools, verificationTarget, needsConfirmation.",
      "Use these types: answer=string, riskNotes=string[], evidenceRefs=string[], plannedTools=string[], verificationTarget=string, needsConfirmation=boolean.",
      "Do not wrap the JSON in Markdown or add commentary before or after it."
    );
  } else {
    parts.push("Return the final assistant reply as plain text without JSON wrappers.");
  }

  return parts.join("\n");
};

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
    const responseMode = params.responseMode ?? "plain-text";
    const systemPrompt = buildSystemPrompt(params.expression, responseMode);

    const result = await generationProvider.generate({
      provider,
      baseUrl,
      model,
      apiKey,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
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
