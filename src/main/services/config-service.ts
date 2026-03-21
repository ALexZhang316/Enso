import * as TOML from "@iarna/toml";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_MODE, MODES, ModeId } from "../../shared/modes";
import { DEFAULT_PROVIDER_ID, PROVIDER_PRESET_MAP } from "../../shared/providers";
import { ActionType, EnsoConfig, ACTION_TYPES, PermissionLevel } from "../../shared/types";

type PartialConfig = Partial<EnsoConfig> & {
  provider?: Partial<EnsoConfig["provider"]>;
};

const kimiPreset = PROVIDER_PRESET_MAP[DEFAULT_PROVIDER_ID];
const MODE_IDS = MODES.map((mode) => mode.id);
const DENSITY_VALUES = ["concise", "standard", "detailed"] as const;
const REPORTING_GRANULARITY_VALUES = ["plan-level", "result-level"] as const;
const PERMISSION_LEVEL_VALUES = ["allow", "confirm", "block"] as const;

const hasOwn = <T extends object>(value: T, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export const DEFAULT_ENSO_CONFIG: EnsoConfig = {
  provider: {
    provider: DEFAULT_PROVIDER_ID,
    baseUrl: kimiPreset.defaultBaseUrl,
    model: kimiPreset.defaultModel,
    apiKey: ""
  },
  expression: {
    density: "standard",
    structuredFirst: false
  },
  reportingGranularity: "plan-level",
  permissions: {
    workspace_write: "confirm",
    host_exec_readonly: "confirm",
    host_exec_destructive: "block",
    external_network: "block"
  },
  modeDefaults: {
    defaultMode: DEFAULT_MODE,
    retrievalByMode: {
      default: false,
      "deep-dialogue": false,
      decision: true,
      research: true
    }
  }
};

export class ConfigValidationError extends Error {
  constructor(
    public readonly configPath: string,
    reason: string
  ) {
    super(`Invalid Enso config at ${configPath}: ${reason}`);
    this.name = "ConfigValidationError";
  }
}

const expectObject = (value: unknown, fieldPath: string, configPath: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigValidationError(configPath, `${fieldPath} must be an object`);
  }

  return value as Record<string, unknown>;
};

const expectString = (value: unknown, fieldPath: string, configPath: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ConfigValidationError(configPath, `${fieldPath} must be a non-empty string`);
  }

  return value;
};

const expectBoolean = (value: unknown, fieldPath: string, configPath: string): boolean => {
  if (typeof value !== "boolean") {
    throw new ConfigValidationError(configPath, `${fieldPath} must be a boolean`);
  }

  return value;
};

const expectEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldPath: string,
  configPath: string
): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ConfigValidationError(
      configPath,
      `${fieldPath} must be one of: ${allowed.join(", ")}`
    );
  }

  return value as T;
};

const normalizeConfig = (partial: PartialConfig, configPath: string): EnsoConfig => {
  const provider = { ...DEFAULT_ENSO_CONFIG.provider };
  const expression = { ...DEFAULT_ENSO_CONFIG.expression };
  let reportingGranularity = DEFAULT_ENSO_CONFIG.reportingGranularity;
  const permissions = { ...DEFAULT_ENSO_CONFIG.permissions };
  const modeDefaults = {
    defaultMode: DEFAULT_ENSO_CONFIG.modeDefaults.defaultMode,
    retrievalByMode: { ...DEFAULT_ENSO_CONFIG.modeDefaults.retrievalByMode }
  };

  if (partial.provider !== undefined) {
    const providerSection = expectObject(partial.provider, "provider", configPath);
    if (hasOwn(providerSection, "provider")) {
      provider.provider = expectEnum(
        providerSection.provider,
        Object.keys(PROVIDER_PRESET_MAP),
        "provider.provider",
        configPath
      ) as EnsoConfig["provider"]["provider"];
    }
    if (hasOwn(providerSection, "baseUrl")) {
      provider.baseUrl = expectString(providerSection.baseUrl, "provider.baseUrl", configPath);
    }
    if (hasOwn(providerSection, "model")) {
      provider.model = expectString(providerSection.model, "provider.model", configPath);
    }
  }

  if (partial.expression !== undefined) {
    const expressionSection = expectObject(partial.expression, "expression", configPath);
    if (hasOwn(expressionSection, "density")) {
      expression.density = expectEnum(expressionSection.density, DENSITY_VALUES, "expression.density", configPath);
    }
    if (hasOwn(expressionSection, "structuredFirst")) {
      expression.structuredFirst = expectBoolean(
        expressionSection.structuredFirst,
        "expression.structuredFirst",
        configPath
      );
    }
  }

  if (hasOwn(partial, "reportingGranularity")) {
    reportingGranularity = expectEnum(
      partial.reportingGranularity,
      REPORTING_GRANULARITY_VALUES,
      "reportingGranularity",
      configPath
    ) as EnsoConfig["reportingGranularity"];
  }

  if (partial.permissions !== undefined) {
    const permissionSection = expectObject(partial.permissions, "permissions", configPath);
    for (const actionType of ACTION_TYPES) {
      if (hasOwn(permissionSection, actionType)) {
        permissions[actionType] = expectEnum(
          permissionSection[actionType],
          PERMISSION_LEVEL_VALUES,
          `permissions.${actionType}`,
          configPath
        ) as PermissionLevel;
      }
    }
  }

  if (partial.modeDefaults !== undefined) {
    const modeDefaultsSection = expectObject(partial.modeDefaults, "modeDefaults", configPath);
    // defaultMode is always "default" -- ignore TOML value
    modeDefaults.defaultMode = DEFAULT_MODE;
    if (hasOwn(modeDefaultsSection, "retrievalByMode")) {
      const retrievalByModeSection = expectObject(
        modeDefaultsSection.retrievalByMode,
        "modeDefaults.retrievalByMode",
        configPath
      );
      for (const modeId of MODE_IDS) {
        if (hasOwn(retrievalByModeSection, modeId)) {
          modeDefaults.retrievalByMode[modeId] = expectBoolean(
            retrievalByModeSection[modeId],
            `modeDefaults.retrievalByMode.${modeId}`,
            configPath
          );
        }
      }
    }
  }

  return {
    provider: {
      ...provider,
      apiKey: ""
    },
    expression,
    reportingGranularity,
    permissions,
    modeDefaults
  };
};

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
      return normalizeConfig(parsed, this.configPath);
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error;
      }

      const detail = error instanceof Error ? error.message : "failed to parse TOML";
      throw new ConfigValidationError(this.configPath, `failed to parse TOML: ${detail}`);
    }
  }

  save(config: EnsoConfig): EnsoConfig {
    this.ensureConfigFile();
    const merged = normalizeConfig(config, this.configPath);
    fs.writeFileSync(
      this.configPath,
      TOML.stringify(sanitizeForPersistence(merged) as any),
      "utf8"
    );
    return merged;
  }
}
