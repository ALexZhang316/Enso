import * as TOML from "@iarna/toml";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_MODE } from "../../shared/modes";
import { EnsoConfig } from "../../shared/types";

export const DEFAULT_ENSO_CONFIG: EnsoConfig = {
  provider: {
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    temperature: 0.2
  },
  expression: {
    style: "balanced",
    reducedQuestioning: true,
    defaultAssumption: "pragmatic"
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

const mergeConfig = (partial: Partial<EnsoConfig>): EnsoConfig => ({
  provider: {
    ...DEFAULT_ENSO_CONFIG.provider,
    ...(partial.provider ?? {})
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

    fs.writeFileSync(this.configPath, TOML.stringify(DEFAULT_ENSO_CONFIG as any), "utf8");
  }

  load(): EnsoConfig {
    this.ensureConfigFile();

    try {
      const raw = fs.readFileSync(this.configPath, "utf8");
      const parsed = TOML.parse(raw) as Partial<EnsoConfig>;
      return mergeConfig(parsed);
    } catch {
      return DEFAULT_ENSO_CONFIG;
    }
  }

  save(config: EnsoConfig): EnsoConfig {
    this.ensureConfigFile();
    const merged = mergeConfig(config);
    fs.writeFileSync(this.configPath, TOML.stringify(merged as any), "utf8");
    return merged;
  }
}
