// Enso v2 配置服务 — 极简版
// 新配置结构：providers (per-provider config) + activeProvider

import * as TOML from "@iarna/toml";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PROVIDER, PROVIDER_PRESETS, ProviderId, PROVIDER_MAP } from "../../shared/providers";
import { EnsoConfig, ProviderConfig } from "../../shared/types";

// 构建默认配置：每个提供商一份
const buildDefaultProviders = (): Record<ProviderId, ProviderConfig> => {
  const result = {} as Record<ProviderId, ProviderConfig>;
  for (const preset of PROVIDER_PRESETS) {
    result[preset.id] = {
      provider: preset.id,
      baseUrl: preset.defaultBaseUrl,
      model: preset.defaultModel,
      apiKey: ""
    };
  }
  return result;
};

export const DEFAULT_ENSO_CONFIG: EnsoConfig = {
  providers: buildDefaultProviders(),
  activeProvider: DEFAULT_PROVIDER
};

export class ConfigService {
  constructor(
    private readonly configPath: string,
    private readonly appPath: string
  ) {}

  private ensureConfigFile(): void {
    if (fs.existsSync(this.configPath)) return;
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });

    // 尝试复制打包的默认配置
    const bundledPath = path.join(this.appPath, "config", "default.toml");
    if (fs.existsSync(bundledPath)) {
      fs.copyFileSync(bundledPath, this.configPath);
      return;
    }

    // 否则写入默认配置
    const sanitized = this.sanitize(DEFAULT_ENSO_CONFIG);
    fs.writeFileSync(this.configPath, TOML.stringify(sanitized as any), "utf8");
  }

  // 清除 apiKey 后的配置（用于持久化）
  private sanitize(config: EnsoConfig): EnsoConfig {
    const providers = { ...config.providers };
    for (const pid of Object.keys(providers) as ProviderId[]) {
      providers[pid] = { ...providers[pid], apiKey: "" };
    }
    return { ...config, providers };
  }

  // 从 TOML 解析结果规范化为 EnsoConfig
  private normalize(raw: any): EnsoConfig {
    const defaults = DEFAULT_ENSO_CONFIG;
    // 深拷贝 providers，防止外部修改污染默认配置对象
    const providers = {} as Record<ProviderId, ProviderConfig>;
    for (const pid of Object.keys(defaults.providers) as ProviderId[]) {
      providers[pid] = { ...defaults.providers[pid] };
    }
    const result: EnsoConfig = {
      providers,
      activeProvider: defaults.activeProvider
    };

    // 解析 activeProvider
    if (typeof raw.activeProvider === "string" && PROVIDER_MAP[raw.activeProvider as ProviderId]) {
      result.activeProvider = raw.activeProvider as ProviderId;
    }

    // 兼容旧配置格式（单个 provider 对象）
    if (raw.provider && typeof raw.provider === "object" && typeof raw.provider.provider === "string") {
      const pid = raw.provider.provider as ProviderId;
      if (PROVIDER_MAP[pid]) {
        result.activeProvider = pid;
        result.providers[pid] = {
          provider: pid,
          baseUrl: raw.provider.baseUrl || PROVIDER_MAP[pid].defaultBaseUrl,
          model: raw.provider.model || PROVIDER_MAP[pid].defaultModel,
          apiKey: ""
        };
      }
    }

    // 解析 providers（新格式）
    if (raw.providers && typeof raw.providers === "object") {
      for (const pid of Object.keys(raw.providers)) {
        const preset = PROVIDER_MAP[pid as ProviderId];
        if (!preset) continue;
        const pc = raw.providers[pid];
        if (typeof pc !== "object") continue;
        result.providers[pid as ProviderId] = {
          provider: pid as ProviderId,
          baseUrl: typeof pc.baseUrl === "string" ? pc.baseUrl : preset.defaultBaseUrl,
          model: typeof pc.model === "string" ? pc.model : preset.defaultModel,
          apiKey: ""
        };
      }
    }

    return result;
  }

  load(): EnsoConfig {
    this.ensureConfigFile();
    try {
      const raw = fs.readFileSync(this.configPath, "utf8");
      const parsed = TOML.parse(raw);
      return this.normalize(parsed);
    } catch {
      return this.normalize({});
    }
  }

  save(config: EnsoConfig): EnsoConfig {
    this.ensureConfigFile();
    const sanitized = this.sanitize(config);
    fs.writeFileSync(this.configPath, TOML.stringify(sanitized as any), "utf8");
    return sanitized;
  }
}
