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
    defaultModel: "gpt-4o",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"]
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-4-20250514"]
  },
  {
    id: "google",
    label: "Gemini",
    defaultModel: "gemini-2.5-pro",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"]
  },
  {
    id: "kimi",
    label: "Kimi",
    defaultModel: "moonshot-v1-auto",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-auto", "moonshot-v1-128k"]
  }
];

export const PROVIDER_MAP: Record<ProviderId, ProviderPreset> = Object.fromEntries(
  PROVIDER_PRESETS.map((p) => [p.id, p])
) as Record<ProviderId, ProviderPreset>;

export const DEFAULT_PROVIDER: ProviderId = "openai";
