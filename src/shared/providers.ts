export type ProviderId = "kimi" | "openai" | "deepseek" | "anthropic" | "gemini";

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
  models: string[];
  baseUrls: string[];
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "kimi",
    label: "Kimi",
    defaultModel: "kimi-k2.5",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    models: ["kimi-k2.5"],
    baseUrls: ["https://api.moonshot.cn/v1", "https://api.moonshot.ai/v1"]
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-5.4",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: ["gpt-5.4"],
    baseUrls: ["https://api.openai.com/v1"]
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat"],
    baseUrls: ["https://api.deepseek.com/v1"]
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-opus-4-6",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    models: ["claude-opus-4-6"],
    baseUrls: ["https://api.anthropic.com/v1"]
  },
  {
    id: "gemini",
    label: "Gemini",
    defaultModel: "gemini-3.1-pro-preview",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-3.1-pro-preview"],
    baseUrls: ["https://generativelanguage.googleapis.com/v1beta"]
  }
];

export const DEFAULT_PROVIDER_ID: ProviderId = "kimi";

export const PROVIDER_PRESET_MAP: Record<string, ProviderPreset> = PROVIDER_PRESETS.reduce(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {} as Record<string, ProviderPreset>
);
