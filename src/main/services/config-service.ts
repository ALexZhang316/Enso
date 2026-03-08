import * as TOML from "@iarna/toml";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_MODE } from "../../shared/modes";
import { DEFAULT_PROVIDER_ID, PROVIDER_PRESET_MAP } from "../../shared/providers";
import { EnsoConfig } from "../../shared/types";

type PartialConfig = Partial<EnsoConfig> & {
  provider?: Partial<EnsoConfig["provider"]>;
};

const kimiPreset = PROVIDER_PRESET_MAP[DEFAULT_PROVIDER_ID];

export const DEFAULT_ENSO_CONFIG: EnsoConfig = {
  provider: {
    provider: DEFAULT_PROVIDER_ID,
    baseUrl: kimiPreset.defaultBaseUrl,
    model: kimiPreset.defaultModel,
    apiKey: ""
  },
  expression: {
    style: "balanced",
    reducedQuestioning: true,
    defaultAssumption: "pragmatic",
    riskLabeling: "balanced-only"
  },
  permissions: {
    readOnlyDefault: true,
    requireConfirmationForWrites: true,
    requireDoubleConfirmationForExternal: true
  },
  modeDefaults: {
    defaultMode: DEFAULT_MODE,
    retrievalByMode: {
      "deep-dialogue": false,
      decision: true,
      research: true
    }
  }
};

const mergeConfig = (partial: PartialConfig): EnsoConfig => ({
  provider: {
    provider:
      partial.provider?.provider && partial.provider.provider in PROVIDER_PRESET_MAP
        ? partial.provider.provider
        : DEFAULT_ENSO_CONFIG.provider.provider,
    baseUrl: partial.provider?.baseUrl ?? DEFAULT_ENSO_CONFIG.provider.baseUrl,
    model: partial.provider?.model ?? DEFAULT_ENSO_CONFIG.provider.model,
    apiKey: ""
  },
  expression: {
    ...DEFAULT_ENSO_CONFIG.expression,
    ...(partial.expression ?? {})
  },
  permissions: {
    ...DEFAULT_ENSO_CONFIG.permissions,
    ...(partial.permissions ?? {})
  },
  modeDefaults: {
    defaultMode: partial.modeDefaults?.defaultMode ?? DEFAULT_ENSO_CONFIG.modeDefaults.defaultMode,
    retrievalByMode: {
      ...DEFAULT_ENSO_CONFIG.modeDefaults.retrievalByMode,
      ...(partial.modeDefaults?.retrievalByMode ?? {})
    }
  }
});

const sanitizeForPersistence = (config: EnsoConfig): EnsoConfig => ({
  ...config,
  provider: {
    ...config.provider,
    apiKey: ""
  }
});

export class ConfigService {
  constructor(
    private readonly configPath: string,
    private readonly appPath: string
  ) {}

  private ensureConfigFile(): void {
    if (fs.existsSync(this.configPath)) {
      return;
    }

    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });

    const bundledDefaultPath = path.join(this.appPath, "config", "default.toml");
    if (fs.existsSync(bundledDefaultPath)) {
      fs.copyFileSync(bundledDefaultPath, this.configPath);
      return;
    }

    fs.writeFileSync(
      this.configPath,
      TOML.stringify(sanitizeForPersistence(DEFAULT_ENSO_CONFIG) as any),
      "utf8"
    );
  }

  load(): EnsoConfig {
    this.ensureConfigFile();

    try {
      const raw = fs.readFileSync(this.configPath, "utf8");
      const parsed = TOML.parse(raw) as PartialConfig;
      return mergeConfig(parsed);
    } catch {
      return DEFAULT_ENSO_CONFIG;
    }
  }

  save(config: EnsoConfig): EnsoConfig {
    this.ensureConfigFile();
    const merged = mergeConfig(config);
    fs.writeFileSync(
      this.configPath,
      TOML.stringify(sanitizeForPersistence(merged) as any),
      "utf8"
    );
    return merged;
  }
}
