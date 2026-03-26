// 模型提供商预设 — Enso v2
// 四家：OpenAI, Anthropic, Google (Gemini), Moonshot (Kimi)
// 不再有 DeepSeek（用户只用四家）

export type ProviderId = "openai" | "anthropic" | "google" | "kimi";

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
  models: string[];
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-5.4",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: ["gpt-5.4"]
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-opus-4-6",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    models: ["claude-opus-4-6"]
  },
  {
    id: "google",
    label: "Gemini",
    defaultModel: "gemini-3.1-pro-preview",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-3.1-pro-preview"]
  },
  {
    id: "kimi",
    label: "Kimi",
    defaultModel: "kimi-k2.5",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    models: ["kimi-k2.5", "moonshot-v1-8k"]
  }
];

export const PROVIDER_MAP: Record<ProviderId, ProviderPreset> = Object.fromEntries(
  PROVIDER_PRESETS.map((p) => [p.id, p])
) as Record<ProviderId, ProviderPreset>;

export const DEFAULT_PROVIDER: ProviderId = "openai";
