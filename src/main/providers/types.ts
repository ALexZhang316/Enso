import { ProviderId } from "../../shared/providers";

export type ProviderErrorCode =
  | "missing_api_key"
  | "auth"
  | "network"
  | "rate_limit"
  | "server"
  | "invalid_request"
  | "unknown";

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TextGenerationRequest {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  messages: ProviderMessage[];
}

export interface TextGenerationResult {
  text: string;
}

export interface TextGenerationProvider {
  readonly id: ProviderId;
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
}
