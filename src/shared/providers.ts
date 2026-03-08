export type ProviderId = "kimi" | "openai" | "deepseek" | "anthropic" | "gemini";

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "kimi",
    label: "Kimi",
    defaultModel: "moonshot-v1-8k",
    defaultBaseUrl: "https://api.moonshot.cn/v1"
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
