/**
 * 集成测试 —— Enso v2 跨模块协作验证
 *
 * 覆盖范围：
 * - ConfigService 配置加载/保存/规范化
 * - SecretService 加密/解密/清除
 * - Store + ConfigService + SecretService 协作
 * - 板块（board）系统验证
 * - 提供商（provider）定义一致性
 *
 * 运行方式：npm run test:integration
 * 依赖编译产物（dist/），运行前需 npm run build。
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");

// v2 模块导入
const { ConfigService, DEFAULT_ENSO_CONFIG } = require(path.join(DIST_ROOT, "main/services/config-service.js"));
const { SecretService } = require(path.join(DIST_ROOT, "main/services/secret-service.js"));
const { EnsoStore } = require(path.join(DIST_ROOT, "main/services/store.js"));
const { BOARDS, BOARD_MAP, DEFAULT_BOARD, getBoardDef } = require(path.join(DIST_ROOT, "shared/boards.js"));
const { PROVIDER_PRESETS, PROVIDER_MAP, DEFAULT_PROVIDER } = require(path.join(DIST_ROOT, "shared/providers.js"));

// -- 测试框架 --

const runTest = async (name, fn) => {
  process.stdout.write(`\n[TEST] ${name}\n`);
  try {
    await fn();
    process.stdout.write(`[PASS] ${name}\n`);
    return true;
  } catch (error) {
    process.stderr.write(`[FAIL] ${name}\n`);
    process.stderr.write(`${error.stack || error}\n`);
    return false;
  }
};

// 创建临时测试环境
const createHarness = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enso-integ-"));
  const dbPath = path.join(tempDir, "enso.sqlite");
  const configPath = path.join(tempDir, "config.toml");
  const secretPath = path.join(tempDir, "secrets.json");

  const store = new EnsoStore(dbPath);
  const configService = new ConfigService(configPath, PROJECT_ROOT);
  const secretService = new SecretService(secretPath);

  return {
    tempDir,
    store,
    configService,
    secretService,
    configPath,
    secretPath,
    cleanup() {
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
};

// -- 测试用例 --

const tests = [
  // ==================== ConfigService ====================
  {
    name: "ConfigService 首次加载时自动创建配置文件",
    fn() {
      const { configService, configPath, cleanup } = createHarness();
      try {
        assert.ok(!fs.existsSync(configPath), "配置文件不应预先存在");
        const config = configService.load();
        assert.ok(fs.existsSync(configPath), "load() 应创建配置文件");
        assert.ok(config.providers, "应包含 providers 字段");
        assert.ok(config.activeProvider, "应包含 activeProvider 字段");
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "ConfigService 加载返回完整的四家提供商配置",
    fn() {
      const { configService, cleanup } = createHarness();
      try {
        const config = configService.load();
        for (const preset of PROVIDER_PRESETS) {
          const pc = config.providers[preset.id];
          assert.ok(pc, `应包含 ${preset.id} 配置`);
          assert.equal(pc.provider, preset.id);
          assert.equal(pc.baseUrl, preset.defaultBaseUrl);
          assert.equal(pc.model, preset.defaultModel);
          assert.equal(pc.apiKey, "", "apiKey 应为空");
        }
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "ConfigService 保存时清除 apiKey",
    fn() {
      const { configService, configPath, cleanup } = createHarness();
      try {
        const config = configService.load();
        // 模拟用户设置了 apiKey
        config.providers.openai.apiKey = "sk-secret-key";
        configService.save(config);

        // 读取持久化后的文件内容
        const rawToml = fs.readFileSync(configPath, "utf8");
        assert.ok(!rawToml.includes("sk-secret-key"), "TOML 文件中不应包含 API Key");

        // 重新加载也应为空
        const reloaded = configService.load();
        assert.equal(reloaded.providers.openai.apiKey, "");
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "ConfigService 保存后保留 activeProvider 修改",
    fn() {
      const { configService, cleanup } = createHarness();
      try {
        const config = configService.load();
        assert.equal(config.activeProvider, DEFAULT_PROVIDER);
        config.activeProvider = "anthropic";
        configService.save(config);
        const reloaded = configService.load();
        assert.equal(reloaded.activeProvider, "anthropic");
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "ConfigService 保存后保留自定义 model 和 baseUrl",
    fn() {
      const { configService, cleanup } = createHarness();
      try {
        const config = configService.load();
        config.providers.openai.model = "gpt-4-turbo";
        config.providers.openai.baseUrl = "https://custom-proxy.example.com/v1";
        configService.save(config);

        const reloaded = configService.load();
        assert.equal(reloaded.providers.openai.model, "gpt-4-turbo");
        assert.equal(reloaded.providers.openai.baseUrl, "https://custom-proxy.example.com/v1");
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "ConfigService 兼容旧的单 provider 配置格式",
    fn() {
      const { configPath, cleanup } = createHarness();
      try {
        // 写入 v1 风格的配置
        const legacyToml = [
          '[provider]',
          'provider = "anthropic"',
          'baseUrl = "https://custom.example.com/v1"',
          'model = "claude-3-opus"',
          ''
        ].join('\n');
        fs.writeFileSync(configPath, legacyToml, "utf8");

        const configService = new ConfigService(configPath, PROJECT_ROOT);
        const config = configService.load();
        assert.equal(config.activeProvider, "anthropic");
        assert.equal(config.providers.anthropic.baseUrl, "https://custom.example.com/v1");
        assert.equal(config.providers.anthropic.model, "claude-3-opus");
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "ConfigService 忽略无效的 activeProvider 值",
    fn() {
      const { configPath, cleanup } = createHarness();
      try {
        const brokenToml = 'activeProvider = "nonexistent_provider"\n';
        fs.writeFileSync(configPath, brokenToml, "utf8");

        const configService = new ConfigService(configPath, PROJECT_ROOT);
        const config = configService.load();
        // 应回退到默认
        assert.equal(config.activeProvider, DEFAULT_PROVIDER);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "ConfigService 对损坏的 TOML 回退到默认配置",
    fn() {
      const { configPath, cleanup } = createHarness();
      try {
        fs.writeFileSync(configPath, "这不是有效的 TOML {{{{", "utf8");

        const configService = new ConfigService(configPath, PROJECT_ROOT);
        const config = configService.load();
        assert.equal(config.activeProvider, DEFAULT_PROVIDER);
        assert.ok(config.providers.openai, "应包含默认 openai 配置");
      } finally {
        cleanup();
      }
    }
  },

  // ==================== SecretService ====================
  {
    name: "SecretService 加密并还原 API Key",
    fn() {
      const { secretService, cleanup } = createHarness();
      try {
        const testKey = "sk-test-1234567890abcdef";
        secretService.saveProviderApiKey("openai", testKey);
        const retrieved = secretService.getProviderApiKey("openai");
        assert.equal(retrieved, testKey);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "SecretService 分别存储不同提供商的 Key",
    fn() {
      const { secretService, cleanup } = createHarness();
      try {
        secretService.saveProviderApiKey("openai", "sk-openai-key");
        secretService.saveProviderApiKey("anthropic", "sk-anthropic-key");
        secretService.saveProviderApiKey("kimi", "sk-kimi-key");

        assert.equal(secretService.getProviderApiKey("openai"), "sk-openai-key");
        assert.equal(secretService.getProviderApiKey("anthropic"), "sk-anthropic-key");
        assert.equal(secretService.getProviderApiKey("kimi"), "sk-kimi-key");
        assert.equal(secretService.getProviderApiKey("google"), null);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "SecretService hasProviderApiKey 正确反映存储状态",
    fn() {
      const { secretService, cleanup } = createHarness();
      try {
        assert.equal(secretService.hasProviderApiKey("openai"), false);
        secretService.saveProviderApiKey("openai", "sk-test");
        assert.equal(secretService.hasProviderApiKey("openai"), true);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "SecretService clearProviderApiKey 清除后无法读取",
    fn() {
      const { secretService, cleanup } = createHarness();
      try {
        secretService.saveProviderApiKey("openai", "sk-test");
        assert.equal(secretService.hasProviderApiKey("openai"), true);
        secretService.clearProviderApiKey("openai");
        assert.equal(secretService.hasProviderApiKey("openai"), false);
        assert.equal(secretService.getProviderApiKey("openai"), null);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "SecretService 空字符串 Key 不被存储",
    fn() {
      const { secretService, cleanup } = createHarness();
      try {
        secretService.saveProviderApiKey("openai", "   ");
        assert.equal(secretService.hasProviderApiKey("openai"), false);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "SecretService 密文使用 fallback AES-256-GCM 格式",
    fn() {
      const { secretService, secretPath, cleanup } = createHarness();
      try {
        secretService.saveProviderApiKey("openai", "sk-test");
        const raw = JSON.parse(fs.readFileSync(secretPath, "utf8"));
        const encrypted = raw.providers.openai;
        // 在非 Electron 环境下应使用 fallback 加密
        assert.ok(encrypted.startsWith("fallback:"), "密文应以 fallback: 开头");
        // 密文由 4 段组成：fallback:iv:tag:data
        const parts = encrypted.split(":");
        assert.equal(parts.length, 4, "fallback 密文应有 4 段");
      } finally {
        cleanup();
      }
    }
  },

  // ==================== 板块系统验证 ====================
  {
    name: "三个板块定义完整且互斥",
    fn() {
      assert.equal(BOARDS.length, 3);
      const ids = BOARDS.map(b => b.id);
      assert.deepEqual(ids.sort(), ["decision", "dialogue", "research"]);
      // 每个板块都有唯一参数
      for (const board of BOARDS) {
        assert.ok(board.label, `${board.id} 应有 label`);
        assert.ok(typeof board.temperature === "number", `${board.id} 应有 temperature`);
        assert.ok(typeof board.maxTokens === "number", `${board.id} 应有 maxTokens`);
        assert.ok(typeof board.historyWindow === "number", `${board.id} 应有 historyWindow`);
      }
    }
  },
  {
    name: "BOARD_MAP 和 getBoardDef 与 BOARDS 数组一致",
    fn() {
      for (const board of BOARDS) {
        assert.equal(BOARD_MAP[board.id].id, board.id);
        assert.equal(getBoardDef(board.id).temperature, board.temperature);
      }
    }
  },
  {
    name: "默认板块是 dialogue",
    fn() {
      assert.equal(DEFAULT_BOARD, "dialogue");
    }
  },

  // ==================== 提供商定义验证 ====================
  {
    name: "四家提供商预设完整",
    fn() {
      assert.equal(PROVIDER_PRESETS.length, 4);
      const ids = PROVIDER_PRESETS.map(p => p.id);
      assert.deepEqual(ids.sort(), ["anthropic", "google", "kimi", "openai"]);
      for (const preset of PROVIDER_PRESETS) {
        assert.ok(preset.label, `${preset.id} 应有 label`);
        assert.ok(preset.defaultModel, `${preset.id} 应有 defaultModel`);
        assert.ok(preset.defaultBaseUrl, `${preset.id} 应有 defaultBaseUrl`);
        assert.ok(preset.models.length > 0, `${preset.id} 应有至少一个模型`);
      }
    }
  },
  {
    name: "PROVIDER_MAP 与 PROVIDER_PRESETS 一致",
    fn() {
      for (const preset of PROVIDER_PRESETS) {
        const mapped = PROVIDER_MAP[preset.id];
        assert.ok(mapped, `PROVIDER_MAP 应包含 ${preset.id}`);
        assert.equal(mapped.defaultModel, preset.defaultModel);
      }
    }
  },
  {
    name: "默认提供商存在于 PROVIDER_MAP 中",
    fn() {
      assert.ok(PROVIDER_MAP[DEFAULT_PROVIDER], "默认提供商应在 PROVIDER_MAP 中");
    }
  },

  // ==================== 跨模块集成 ====================
  {
    name: "Store 多板块会话隔离：不同板块的会话互不干扰",
    fn() {
      const { store, cleanup } = createHarness();
      try {
        store.createConversation("dialogue", "对话 1");
        store.createConversation("dialogue", "对话 2");
        store.createConversation("decision", "决策 1");
        store.createConversation("research", "研究 1");

        assert.equal(store.listConversations("dialogue").length, 2);
        assert.equal(store.listConversations("decision").length, 1);
        assert.equal(store.listConversations("research").length, 1);
        assert.equal(store.listConversations().length, 4);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store + SecretService 完整生命周期：创建会话 → 存 Key → 读 Key → 清 Key",
    fn() {
      const { store, secretService, cleanup } = createHarness();
      try {
        // 创建会话
        const conv = store.createConversation("dialogue", "测试流程");
        store.addMessage(conv.id, "user", "你好");
        store.updateConversationModel(conv.id, "gpt-5.4");

        // 存储 API Key
        secretService.saveProviderApiKey("openai", "sk-test-key");
        assert.ok(secretService.hasProviderApiKey("openai"));

        // 验证会话和 Key 独立
        const fetched = store.getConversation(conv.id);
        assert.equal(fetched.model, "gpt-5.4");
        assert.equal(secretService.getProviderApiKey("openai"), "sk-test-key");

        // 清除 Key 不影响会话
        secretService.clearProviderApiKey("openai");
        assert.equal(store.getConversation(conv.id).model, "gpt-5.4");
        assert.equal(secretService.hasProviderApiKey("openai"), false);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "ConfigService + SecretService 配置和密钥分离存储",
    fn() {
      const { configService, secretService, configPath, secretPath, cleanup } = createHarness();
      try {
        // 保存配置和密钥
        const config = configService.load();
        config.activeProvider = "kimi";
        configService.save(config);
        secretService.saveProviderApiKey("kimi", "sk-kimi-secret");

        // 验证配置文件不含密钥
        const tomlContent = fs.readFileSync(configPath, "utf8");
        assert.ok(!tomlContent.includes("sk-kimi-secret"), "TOML 不应含密钥");

        // 验证密钥文件不含配置
        const secretContent = fs.readFileSync(secretPath, "utf8");
        assert.ok(!secretContent.includes("activeProvider"), "密钥文件不应含配置");

        // 两者独立正确
        const reloadedConfig = configService.load();
        assert.equal(reloadedConfig.activeProvider, "kimi");
        assert.equal(secretService.getProviderApiKey("kimi"), "sk-kimi-secret");
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store ensureDefaultConversation 为每个板块独立创建默认会话",
    fn() {
      const { store, cleanup } = createHarness();
      try {
        const d1 = store.ensureDefaultConversation("dialogue");
        const d2 = store.ensureDefaultConversation("decision");
        const r1 = store.ensureDefaultConversation("research");

        // 三个不同的会话
        assert.notEqual(d1.id, d2.id);
        assert.notEqual(d2.id, r1.id);

        assert.equal(d1.board, "dialogue");
        assert.equal(d2.board, "decision");
        assert.equal(r1.board, "research");

        // 再次调用返回已有的
        const d1Again = store.ensureDefaultConversation("dialogue");
        assert.equal(d1Again.id, d1.id);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "DEFAULT_ENSO_CONFIG 与 PROVIDER_PRESETS 保持同步",
    fn() {
      const defaults = DEFAULT_ENSO_CONFIG;
      for (const preset of PROVIDER_PRESETS) {
        const pc = defaults.providers[preset.id];
        assert.ok(pc, `默认配置应包含 ${preset.id}`);
        assert.equal(pc.provider, preset.id);
        assert.equal(pc.baseUrl, preset.defaultBaseUrl);
        assert.equal(pc.model, preset.defaultModel);
      }
      assert.equal(defaults.activeProvider, DEFAULT_PROVIDER);
    }
  },
];

// -- 运行 --

(async () => {
  let passed = 0;
  let failed = 0;
  for (const entry of tests) {
    if (await runTest(entry.name, entry.fn)) {
      passed += 1;
    } else {
      failed += 1;
    }
  }
  const total = passed + failed;
  process.stdout.write(`\n集成测试通过：${passed}/${total} 通过。\n`);
  if (failed > 0) {
    process.exit(1);
  }
})();
