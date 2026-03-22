const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");

const { ConfigService, ConfigValidationError } = require(path.join(DIST_ROOT, "main/services/config-service.js"));
const { AnthropicProvider } = require(path.join(DIST_ROOT, "main/providers/anthropic-provider.js"));
const { DeepSeekProvider } = require(path.join(DIST_ROOT, "main/providers/deepseek-provider.js"));
const { ExecutionFlow } = require(path.join(DIST_ROOT, "main/core/execution-flow.js"));
const { GeminiProvider } = require(path.join(DIST_ROOT, "main/providers/gemini-provider.js"));
const { HostExecService } = require(path.join(DIST_ROOT, "main/services/host-exec-service.js"));
const { KnowledgeService } = require(path.join(DIST_ROOT, "main/services/knowledge-service.js"));
const { ModelAdapter } = require(path.join(DIST_ROOT, "main/services/model-adapter.js"));
const { createTextGenerationProvider } = require(path.join(DIST_ROOT, "main/providers/provider-factory.js"));
const { OpenAIProvider } = require(path.join(DIST_ROOT, "main/providers/openai-provider.js"));
const { SecretService } = require(path.join(DIST_ROOT, "main/services/secret-service.js"));
const { EnsoStore } = require(path.join(DIST_ROOT, "main/services/store.js"));
const { ToolService } = require(path.join(DIST_ROOT, "main/services/tool-service.js"));
const { WorkspaceService } = require(path.join(DIST_ROOT, "main/services/workspace-service.js"));
const { DEFAULT_MODE } = require(path.join(DIST_ROOT, "shared/modes.js"));
const { PROVIDER_PRESETS } = require(path.join(DIST_ROOT, "shared/providers.js"));
const { KimiProvider } = require(path.join(DIST_ROOT, "main/providers/kimi-provider.js"));
const { ProviderError } = require(path.join(DIST_ROOT, "main/providers/types.js"));

const createHarness = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enso-test-"));
  const dbPath = path.join(tempDir, "enso.sqlite");
  const configPath = path.join(tempDir, "config.toml");
  const secretPath = path.join(tempDir, "secrets.json");
  const workspaceRoot = path.join(tempDir, "workspace");
  const store = new EnsoStore(dbPath);
  const configService = new ConfigService(configPath, PROJECT_ROOT);
  const secretService = new SecretService(secretPath);
  const knowledgeService = new KnowledgeService(store);
  const toolService = new ToolService();
  const workspaceService = new WorkspaceService(workspaceRoot);
  const hostExecService = new HostExecService(workspaceRoot);
  const modelAdapter = new ModelAdapter(secretService);
  const executionFlow = new ExecutionFlow({
    store,
    configService,
    knowledgeService,
    toolService,
    modelAdapter,
    workspaceService,
    hostExecService
  });

  return {
    tempDir,
    dbPath,
    configPath,
    secretPath,
    workspaceRoot,
    store,
    configService,
    secretService,
    knowledgeService,
    workspaceService,
    executionFlow,
    cleanup() {
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
};

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

const mockKimiReply = (text) => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: text
            }
          }
        ]
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  return () => {
    global.fetch = originalFetch;
  };
};

const mockKimiReplyWithCount = (text) => {
  const originalFetch = global.fetch;
  let callCount = 0;
  global.fetch = async () => {
    callCount += 1;
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: text
            }
          }
        ]
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  };

  return {
    getCallCount: () => callCount,
    restore() {
      global.fetch = originalFetch;
    }
  };
};

const mockJsonFetch = (payload, status = 200) => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" }
    });

  return () => {
    global.fetch = originalFetch;
  };
};

const updatePermissions = (harness, overrides) => {
  const currentConfig = harness.configService.load();
  return harness.configService.save({
    ...currentConfig,
    permissions: {
      ...currentConfig.permissions,
      ...overrides
    }
  });
};

const tests = [
  {
    name: "Default mode remains the standalone neutral mode",
    fn: async () => {
      const harness = createHarness();

      try {
        const config = harness.configService.load();
        const conversation = harness.store.ensureDefaultConversation();

        assert.equal(DEFAULT_MODE, "default");
        assert.equal(config.modeDefaults.defaultMode, "default");
        assert.equal(config.modeDefaults.retrievalByMode.default, false);
        assert.equal(conversation.mode, "default");
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ConfigService never persists provider API keys in config.toml",
    fn: async () => {
      const harness = createHarness();

      try {
        const saved = harness.configService.save({
          ...harness.configService.load(),
          provider: {
            provider: "kimi",
            baseUrl: "https://api.moonshot.cn/v1",
            model: "kimi-k2.5",
            apiKey: "should-not-persist"
          }
        });

        const reloaded = harness.configService.load();
        const rawToml = fs.readFileSync(harness.configPath, "utf8");

        assert.equal(saved.provider.provider, "kimi");
        assert.equal(reloaded.provider.model, "kimi-k2.5");
        assert.equal(reloaded.provider.apiKey, "");
        assert.equal(rawToml.includes("should-not-persist"), false);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ConfigService ignores invalid defaultMode and forces default",
    fn: async () => {
      const harness = createHarness();

      try {
        fs.writeFileSync(
          harness.configPath,
          [
            "[modeDefaults]",
            'defaultMode = "boom"',
            "",
            "[modeDefaults.retrievalByMode]",
            "default = false",
            '"deep-dialogue" = false',
            "decision = true",
            "research = true"
          ].join("\n"),
          "utf8"
        );

        // defaultMode is now always forced to "default", so invalid TOML values are silently ignored
        const config = harness.configService.load();
        assert.strictEqual(config.modeDefaults.defaultMode, "default");
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ConfigService rejects non-boolean retrieval flags in config.toml",
    fn: async () => {
      const harness = createHarness();

      try {
        fs.writeFileSync(
          harness.configPath,
          [
            "[modeDefaults]",
            'defaultMode = "default"',
            "",
            "[modeDefaults.retrievalByMode]",
            'default = "yes"',
            '"deep-dialogue" = false',
            "decision = true",
            "research = true"
          ].join("\n"),
          "utf8"
        );

        assert.throws(
          () => harness.configService.load(),
          (error) =>
            error instanceof ConfigValidationError &&
            error.message.includes("modeDefaults.retrievalByMode.default")
        );
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ConfigService rejects malformed TOML instead of falling back to defaults",
    fn: async () => {
      const harness = createHarness();

      try {
        fs.writeFileSync(harness.configPath, "[[not toml", "utf8");

        assert.throws(
          () => harness.configService.load(),
          (error) =>
            error instanceof ConfigValidationError &&
            error.message.includes("failed to parse TOML")
        );
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "SecretService encrypts and restores the Kimi API key",
    fn: async () => {
      const harness = createHarness();

      try {
        harness.secretService.saveProviderApiKey("kimi", "kimi-secret-123");
        const rawSecrets = fs.readFileSync(harness.secretPath, "utf8");

        assert.equal(harness.secretService.getProviderApiKey("kimi"), "kimi-secret-123");
        assert.equal(rawSecrets.includes("kimi-secret-123"), false);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "KimiProvider maps 401 responses to auth errors",
    fn: async () => {
      const originalFetch = global.fetch;
      global.fetch = async () =>
        new Response(JSON.stringify({ error: { message: "bad key" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });

      try {
        const provider = new KimiProvider();
        await assert.rejects(
          provider.generate({
            provider: "kimi",
            baseUrl: "https://api.moonshot.cn/v1",
            model: "kimi-k2.5",
            apiKey: "bad-key",
            messages: [{ role: "user", content: "hello" }]
          }),
          (error) =>
            error instanceof ProviderError &&
            error.code === "auth" &&
            error.message.toLowerCase().includes("kimi")
        );
      } finally {
        global.fetch = originalFetch;
      }
    }
  },
  {
    name: "OpenAIProvider extracts assistant text from chat completions",
    fn: async () => {
      const restoreFetch = mockJsonFetch({
        choices: [
          {
            message: {
              content: "openai reply"
            }
          }
        ]
      });

      try {
        const provider = new OpenAIProvider();
        const result = await provider.generate({
          provider: "openai",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-5.4",
          apiKey: "openai-key",
          messages: [{ role: "user", content: "hello" }]
        });

        assert.equal(result.text, "openai reply");
      } finally {
        restoreFetch();
      }
    }
  },
  {
    name: "DeepSeekProvider extracts assistant text from chat completions",
    fn: async () => {
      const restoreFetch = mockJsonFetch({
        choices: [
          {
            message: {
              content: "deepseek reply"
            }
          }
        ]
      });

      try {
        const provider = new DeepSeekProvider();
        const result = await provider.generate({
          provider: "deepseek",
          baseUrl: "https://api.deepseek.com/v1",
          model: "deepseek-chat",
          apiKey: "deepseek-key",
          messages: [{ role: "user", content: "hello" }]
        });

        assert.equal(result.text, "deepseek reply");
      } finally {
        restoreFetch();
      }
    }
  },
  {
    name: "AnthropicProvider extracts assistant text from messages API",
    fn: async () => {
      const restoreFetch = mockJsonFetch({
        content: [
          {
            type: "text",
            text: "anthropic reply"
          }
        ]
      });

      try {
        const provider = new AnthropicProvider();
        const result = await provider.generate({
          provider: "anthropic",
          baseUrl: "https://api.anthropic.com/v1",
          model: "claude-opus-4-6",
          apiKey: "anthropic-key",
          messages: [{ role: "user", content: "hello" }]
        });

        assert.equal(result.text, "anthropic reply");
      } finally {
        restoreFetch();
      }
    }
  },
  {
    name: "GeminiProvider extracts assistant text from generateContent",
    fn: async () => {
      const restoreFetch = mockJsonFetch({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "gemini reply"
                }
              ]
            }
          }
        ]
      });

      try {
        const provider = new GeminiProvider();
        const result = await provider.generate({
          provider: "gemini",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta",
          model: "gemini-3.1-pro-preview",
          apiKey: "gemini-key",
          messages: [{ role: "user", content: "hello" }]
        });

        assert.equal(result.text, "gemini reply");
      } finally {
        restoreFetch();
      }
    }
  },
  {
    name: "Every provider preset exposed to the app has a concrete runtime implementation",
    fn: async () => {
      for (const preset of PROVIDER_PRESETS) {
        try {
          const provider = createTextGenerationProvider(preset.id);
          assert.equal(provider.id, preset.id);
        } catch (error) {
          assert.fail(
            `Provider preset ${preset.id} must have a concrete runtime implementation: ${error instanceof Error ? error.message : error}`
          );
        }
      }
    }
  },
  {
    name: "ExecutionFlow persists a normal Kimi conversation roundtrip",
    fn: async () => {
      const harness = createHarness();
      const restoreFetch = mockKimiReply("这是来自 Kimi 的真实对话链路回复。");

      try {
        updatePermissions(harness, { external_network: "allow" });
        harness.secretService.saveProviderApiKey("kimi", "kimi-secret-123");
        const conversation = harness.store.createConversation("deep-dialogue", "Kimi 对话测试");

        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "deep-dialogue",
          text: "你好，Kimi。",
          enableRetrievalForTurn: false
        });

        const messages = harness.store.listMessages(conversation.id);
        assert.equal(messages.length, 2);
        assert.equal(messages[0].role, "user");
        assert.equal(messages[0].content, "你好，Kimi。");
        assert.equal(messages[1].role, "assistant");
        assert.equal(messages[1].content, "这是来自 Kimi 的真实对话链路回复。");
        assert.equal(result.audit.resultType, "answer");
        assert.equal(result.state.taskStatus, "completed");
      } finally {
        restoreFetch();
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow keeps informational action wording on the dialogue path",
    fn: async () => {
      const harness = createHarness();
      const restoreFetch = mockKimiReply("normal dialogue reply");

      try {
        updatePermissions(harness, { external_network: "allow" });
        harness.secretService.saveProviderApiKey("kimi", "kimi-secret-123");
        const conversation = harness.store.createConversation("default", "Informational prompts");

        const updateResult = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Can you update me on the current baseline?",
          enableRetrievalForTurn: false
        });
        const notesResult = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "How do I write meeting notes?",
          enableRetrievalForTurn: false
        });

        assert.equal(updateResult.classification.handlingClass, "pure-dialogue");
        assert.equal(updateResult.state.pendingConfirmation, false);
        assert.equal(updateResult.audit.resultType, "answer");
        assert.equal(notesResult.classification.handlingClass, "pure-dialogue");
        assert.equal(notesResult.state.pendingConfirmation, false);
        assert.equal(notesResult.audit.resultType, "answer");
      } finally {
        restoreFetch();
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow blocks unsupported actions and persists blocked trace state",
    fn: async () => {
      const harness = createHarness();

      try {
        const conversation = harness.store.createConversation("default", "Blocked action");

        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Delete the README.md file.",
          enableRetrievalForTurn: false
        });

        const persistedState = harness.store.getState(conversation.id);
        const messages = harness.store.listMessages(conversation.id);
        const phases = persistedState.trace.map((entry) => entry.phase);

        assert.equal(result.classification.handlingClass, "action-adjacent");
        assert.equal(result.state.pendingConfirmation, false);
        assert.equal(result.state.pendingAction, null);
        assert.equal(result.state.taskStatus, "completed");
        assert.equal(result.verification.status, "blocked");
        assert.equal(result.verification.detail, "unsupported action blocked");
        assert.equal(result.audit.resultType, "proposal");
        assert.equal(result.audit.riskNotes, "unsupported action blocked");
        assert.equal(messages.length, 2);
        assert.equal(messages[1].content.includes("当前仅支持工作区内写入提案"), true);
        assert.deepEqual(phases, ["classify", "plan", "gate", "verification", "persist"]);
        assert.equal(
          persistedState.trace.some((entry) => entry.summary.includes("unsupported action remains blocked")),
          true
        );
        assert.equal(persistedState.verification.status, "blocked");
        assert.equal(persistedState.verification.detail, "unsupported action blocked");
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow executes workspace writes immediately when workspace_write is allow",
    fn: async () => {
      const harness = createHarness();

      try {
        updatePermissions(harness, { workspace_write: "allow" });
        const conversation = harness.store.createConversation("default", "Workspace write allow");
        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Write a report file",
          enableRetrievalForTurn: false
        });

        const outputsDir = path.join(harness.workspaceRoot, "outputs");
        const outputFiles = fs.readdirSync(outputsDir);

        assert.equal(result.classification.handlingClass, "action-adjacent");
        assert.equal(result.state.pendingConfirmation, false);
        assert.equal(result.state.pendingAction, null);
        assert.deepEqual(result.state.toolsCalled, ["workspace-write"]);
        assert.equal(result.verification.status, "passed");
        assert.equal(outputFiles.length, 1);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow blocks workspace writes when workspace_write is block",
    fn: async () => {
      const harness = createHarness();

      try {
        updatePermissions(harness, { workspace_write: "block" });
        const conversation = harness.store.createConversation("default", "Workspace write block");
        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Write a report file",
          enableRetrievalForTurn: false
        });

        const outputsDir = path.join(harness.workspaceRoot, "outputs");
        const outputFiles = fs.readdirSync(outputsDir);

        assert.equal(result.classification.handlingClass, "action-adjacent");
        assert.equal(result.state.pendingConfirmation, false);
        assert.equal(result.state.pendingAction, null);
        assert.equal(result.verification.status, "blocked");
        assert.equal(result.state.trace.some((entry) => entry.phase === "gate"), true);
        assert.equal(outputFiles.length, 0);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow proposes and executes safe host exec commands inside the workspace",
    fn: async () => {
      const harness = createHarness();

      try {
        const outputsDir = path.join(harness.workspaceRoot, "outputs");
        fs.mkdirSync(outputsDir, { recursive: true });
        fs.writeFileSync(path.join(outputsDir, "exec-safe.txt"), "safe", "utf8");

        const conversation = harness.store.createConversation("default", "Host exec");
        const proposal = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Run `Get-ChildItem outputs`",
          enableRetrievalForTurn: false
        });

        assert.equal(proposal.classification.handlingClass, "action-adjacent");
        assert.equal(proposal.state.pendingConfirmation, true);
        assert.equal(proposal.state.pendingAction?.kind, "host_exec");
        assert.equal(proposal.audit.resultType, "proposal");
        assert.equal(proposal.audit.riskNotes.includes("Get-ChildItem outputs"), true);

        const resolved = harness.executionFlow.resolvePendingAction(conversation.id);

        assert.equal(resolved.state.pendingConfirmation, false);
        assert.equal(resolved.state.pendingAction, null);
        assert.deepEqual(resolved.state.toolsCalled, ["exec"]);
        assert.equal(resolved.state.verification.status, "passed");
        assert.equal(resolved.audit.resultType, "answer");
        assert.equal(resolved.assistantMessage.content.includes("Get-ChildItem outputs"), true);
        assert.equal(resolved.assistantMessage.content.includes("exec-safe.txt"), true);
        assert.equal(resolved.assistantMessage.content.includes("退出码: 0"), true);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow executes safe host exec commands immediately when host_exec_readonly is allow",
    fn: async () => {
      const harness = createHarness();

      try {
        updatePermissions(harness, { host_exec_readonly: "allow" });
        const outputsDir = path.join(harness.workspaceRoot, "outputs");
        fs.mkdirSync(outputsDir, { recursive: true });
        fs.writeFileSync(path.join(outputsDir, "allow-exec.txt"), "safe", "utf8");

        const conversation = harness.store.createConversation("default", "Host exec allow");
        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Run `Get-ChildItem outputs`",
          enableRetrievalForTurn: false
        });

        assert.equal(result.classification.handlingClass, "action-adjacent");
        assert.equal(result.state.pendingConfirmation, false);
        assert.equal(result.state.pendingAction, null);
        assert.deepEqual(result.state.toolsCalled, ["exec"]);
        assert.equal(result.verification.status, "passed");
        assert.equal(result.assistantMessage.content.includes("allow-exec.txt"), true);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow blocks safe host exec commands when host_exec_readonly is block",
    fn: async () => {
      const harness = createHarness();

      try {
        updatePermissions(harness, { host_exec_readonly: "block" });
        const outputsDir = path.join(harness.workspaceRoot, "outputs");
        fs.mkdirSync(outputsDir, { recursive: true });
        fs.writeFileSync(path.join(outputsDir, "block-exec.txt"), "safe", "utf8");

        const conversation = harness.store.createConversation("default", "Host exec block");
        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Run `Get-ChildItem outputs`",
          enableRetrievalForTurn: false
        });

        assert.equal(result.classification.handlingClass, "action-adjacent");
        assert.equal(result.state.pendingConfirmation, false);
        assert.equal(result.state.pendingAction, null);
        assert.equal(result.verification.status, "blocked");
        assert.equal(result.state.trace.some((entry) => entry.phase === "gate"), true);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow keeps destructive host exec commands blocked",
    fn: async () => {
      const harness = createHarness();

      try {
        const conversation = harness.store.createConversation("default", "Unsafe host exec");
        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Run `Remove-Item outputs\\\\exec-safe.txt`",
          enableRetrievalForTurn: false
        });

        assert.equal(result.classification.handlingClass, "action-adjacent");
        assert.equal(result.state.pendingConfirmation, false);
        assert.equal(result.state.pendingAction, null);
        assert.equal(result.verification.status, "blocked");
        assert.equal(result.audit.resultType, "proposal");
        assert.equal(result.audit.riskNotes, "unsupported host exec command blocked");
        assert.equal(result.assistantMessage.content.includes("仅支持在 Enso 工作区内执行只读命令"), true);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow blocks host exec commands that target paths outside the workspace",
    fn: async () => {
      const harness = createHarness();

      try {
        updatePermissions(harness, { host_exec_readonly: "allow" });
        const conversation = harness.store.createConversation("default", "Host exec outside workspace");
        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Run `Get-ChildItem C:\\`",
          enableRetrievalForTurn: false
        });

        assert.equal(result.classification.handlingClass, "action-adjacent");
        assert.equal(result.state.pendingConfirmation, false);
        assert.equal(result.state.pendingAction, null);
        assert.equal(result.verification.status, "blocked");
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "KnowledgeService prioritizes exact phrase matches over loose keyword hits",
    fn: async () => {
      const harness = createHarness();

      try {
        const sourceId = harness.store.addKnowledgeSource(
          "ranking.md",
          path.join(harness.tempDir, "ranking.md")
        );
        harness.store.insertKnowledgeChunk(
          sourceId,
          0,
          "The Enso local workspace keeps evidence visible for the operator."
        );
        harness.store.insertKnowledgeChunk(
          sourceId,
          1,
          "Enso keeps local notes and a workspace audit trail for the operator."
        );
        harness.store.updateKnowledgeSourceChunkCount(sourceId, 2);

        const snippets = harness.knowledgeService.retrieve("Enso local workspace", 2);

        assert.equal(snippets.length, 2);
        assert.equal(snippets[0].content.includes("Enso local workspace"), true);
        assert.ok(snippets[0].score > snippets[1].score);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow honors per-turn retrieval override and persists snippet metadata",
    fn: async () => {
      const harness = createHarness();
      const restoreFetch = mockKimiReply("retrieval override reply");

      try {
        updatePermissions(harness, { external_network: "allow" });
        harness.secretService.saveProviderApiKey("kimi", "kimi-secret-123");
        const docPath = path.join(harness.tempDir, "knowledge.md");
        fs.writeFileSync(
          docPath,
          "Enso local workspace keeps evidence visible for the operator.",
          "utf8"
        );
        await harness.knowledgeService.ingestFile(docPath);

        const conversation = harness.store.createConversation("default", "Retrieval override");
        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Enso local workspace",
          enableRetrievalForTurn: true
        });

        assert.equal(result.classification.retrievalNeeded, true);
        assert.ok(result.retrievedSnippets.length > 0);
        assert.equal(result.state.retrievalUsed, true);
        assert.equal(result.verification.status, "passed");
        assert.ok(Array.isArray(result.assistantMessage.metadata.retrievedSnippets));
        assert.equal(
          result.assistantMessage.metadata.retrievedSnippets.length,
          result.retrievedSnippets.length
        );
      } finally {
        restoreFetch();
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow uses config retrieval defaults and fails verification without evidence",
    fn: async () => {
      const harness = createHarness();
      const restoreFetch = mockKimiReply("reply without evidence");

      try {
        updatePermissions(harness, { external_network: "allow" });
        harness.secretService.saveProviderApiKey("kimi", "kimi-secret-123");
        const docPath = path.join(harness.tempDir, "knowledge.md");
        fs.writeFileSync(docPath, "Enso keeps local artifacts in the workspace.", "utf8");
        await harness.knowledgeService.ingestFile(docPath);

        const currentConfig = harness.configService.load();
        harness.configService.save({
          ...currentConfig,
          modeDefaults: {
            ...currentConfig.modeDefaults,
            retrievalByMode: {
              ...currentConfig.modeDefaults.retrievalByMode,
              default: true
            }
          }
        });

        const conversation = harness.store.createConversation("default", "Config retrieval default");
        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "query with no matching chunks",
          enableRetrievalForTurn: false
        });

        assert.equal(result.classification.retrievalNeeded, true);
        assert.equal(result.retrievedSnippets.length, 0);
        assert.equal(result.verification.status, "failed");
        assert.match(result.verification.detail, /\[fail\] retrieval returned snippets/);
      } finally {
        restoreFetch();
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow blocks remote model calls when external_network is block",
    fn: async () => {
      const harness = createHarness();
      const mocked = mockKimiReplyWithCount("network should stay blocked");

      try {
        updatePermissions(harness, { external_network: "block" });
        harness.secretService.saveProviderApiKey("kimi", "kimi-secret-123");
        const conversation = harness.store.createConversation("default", "Network block");
        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "hello",
          enableRetrievalForTurn: false
        });

        assert.equal(result.classification.handlingClass, "pure-dialogue");
        assert.equal(mocked.getCallCount(), 0);
        assert.equal(result.state.pendingConfirmation, false);
        assert.equal(result.verification.status, "blocked");
        assert.equal(result.state.trace.some((entry) => entry.phase === "gate"), true);
      } finally {
        mocked.restore();
        harness.cleanup();
      }
    }
  },
  {
    name: "Workspace write proposals execute after confirmation inside the Enso workspace",
    fn: async () => {
      const harness = createHarness();
      const restoreFetch = mockKimiReply("# 会议纪要\n\n- 已整理关键结论。");

      try {
        updatePermissions(harness, { external_network: "allow" });
        harness.secretService.saveProviderApiKey("kimi", "kimi-secret-123");
        const conversation = harness.store.createConversation("default", "Workspace write");

        const proposal = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "请写一份会议纪要文件",
          enableRetrievalForTurn: false
        });

        assert.equal(proposal.classification.handlingClass, "action-adjacent");
        assert.equal(proposal.state.pendingConfirmation, true);
        assert.ok(proposal.state.pendingAction);
        assert.equal(proposal.audit.resultType, "proposal");
        assert.equal(fs.existsSync(proposal.state.pendingAction.targetPath), false);

        const resolved = harness.executionFlow.resolvePendingAction(conversation.id);

        assert.equal(resolved.state.pendingConfirmation, false);
        assert.equal(resolved.state.pendingAction, null);
        assert.deepEqual(resolved.state.toolsCalled, ["workspace-write"]);
        assert.equal(resolved.state.verification.status, "passed");
        assert.equal(resolved.audit.resultType, "answer");
        assert.ok(fs.existsSync(proposal.state.pendingAction.targetPath));
        assert.match(
          fs.readFileSync(proposal.state.pendingAction.targetPath, "utf8"),
          /会议纪要/
        );
      } finally {
        restoreFetch();
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow injects expression config into the model system prompt",
    fn: async () => {
      const harness = createHarness();
      const originalFetch = global.fetch;
      let capturedMessages = null;

      global.fetch = async (_url, init = {}) => {
        const payload = JSON.parse(init.body);
        capturedMessages = payload.messages;

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer: "captured structured answer",
                    riskNotes: [],
                    evidenceRefs: [],
                    plannedTools: [],
                    verificationTarget: "model reply exists",
                    needsConfirmation: false
                  })
                }
              }
            ]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      };

      try {
        updatePermissions(harness, { external_network: "allow" });
        const currentConfig = harness.configService.load();
        harness.configService.save({
          ...currentConfig,
          expression: {
            density: "detailed",
            structuredFirst: true
          },
          reportingGranularity: "plan-level"
        });
        harness.secretService.saveProviderApiKey("kimi", "kimi-secret-123");
        const conversation = harness.store.createConversation("default", "Expression config prompt");

        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Explain the current execution setup.",
          enableRetrievalForTurn: false
        });

        assert.equal(result.assistantMessage.content, "captured structured answer");
        assert.ok(Array.isArray(capturedMessages));
        assert.equal(capturedMessages[0].role, "system");
        assert.equal(capturedMessages[0].content.includes("density=detailed"), true);
        assert.equal(capturedMessages[0].content.includes("structuredFirst=true"), true);
        assert.equal(capturedMessages[0].content.includes("reportingGranularity=plan-level"), true);
        assert.equal(
          capturedMessages[0].content.includes(
            "Return only valid JSON with exactly these keys: answer, riskNotes, evidenceRefs, plannedTools, verificationTarget, needsConfirmation."
          ),
          true
        );
      } finally {
        global.fetch = originalFetch;
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow parses structured draft JSON into the final assistant reply",
    fn: async () => {
      const harness = createHarness();
      const restoreFetch = mockKimiReply(
        JSON.stringify({
          answer: "Parsed structured answer",
          riskNotes: ["needs follow-up"],
          evidenceRefs: ["证据1"],
          plannedTools: ["search"],
          verificationTarget: "final answer recorded",
          needsConfirmation: false
        })
      );

      try {
        updatePermissions(harness, { external_network: "allow" });
        harness.secretService.saveProviderApiKey("kimi", "kimi-secret-123");
        const conversation = harness.store.createConversation("default", "Structured draft parsing");

        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Summarize the latest execution result.",
          enableRetrievalForTurn: false
        });

        assert.equal(result.assistantMessage.content, "Parsed structured answer");
        assert.deepEqual(result.assistantMessage.metadata.riskNotes, ["needs follow-up"]);
        assert.deepEqual(result.assistantMessage.metadata.evidenceRefs, ["证据1"]);
        assert.deepEqual(result.assistantMessage.metadata.plannedTools, ["search"]);
        assert.equal(result.assistantMessage.metadata.verificationTarget, "final answer recorded");
        assert.equal(result.assistantMessage.metadata.needsConfirmation, false);
        assert.equal(result.audit.riskNotes, "needs follow-up");
        assert.equal(result.verification.status, "passed");
      } finally {
        restoreFetch();
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow falls back to plain text when structured draft JSON is malformed",
    fn: async () => {
      const harness = createHarness();
      const restoreFetch = mockKimiReply("plain text fallback reply");

      try {
        updatePermissions(harness, { external_network: "allow" });
        harness.secretService.saveProviderApiKey("kimi", "kimi-secret-123");
        const conversation = harness.store.createConversation("default", "Malformed structured draft");

        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "default",
          text: "Give me a direct answer.",
          enableRetrievalForTurn: false
        });

        assert.equal(result.assistantMessage.content, "plain text fallback reply");
        assert.equal(result.assistantMessage.metadata.structuredDraftFallback, true);
        assert.deepEqual(result.assistantMessage.metadata.riskNotes, []);
        assert.deepEqual(result.assistantMessage.metadata.evidenceRefs, []);
        assert.deepEqual(result.assistantMessage.metadata.plannedTools, []);
        assert.equal(result.assistantMessage.metadata.needsConfirmation, false);
        assert.equal(result.audit.riskNotes, "");
        assert.equal(result.verification.status, "passed");
      } finally {
        restoreFetch();
        harness.cleanup();
      }
    }
  }
  ,
  {
    name: "ToolService returns structured compute results",
    fn: async () => {
      const result = new ToolService().decideAndRun("calculate 2 + 2", []);

      assert.ok(result);
      assert.equal(result.toolName, "compute");
      assert.equal(result.success, true);
      assert.equal(result.output, "2 + 2 = 4");
      assert.deepEqual(result.sideEffects, []);
      assert.equal(result.error, undefined);
      assert.equal(result.summary, "2 + 2 = 4");
    }
  },
  {
    name: "ToolService writes real files and returns structured workspace-write results",
    fn: async () => {
      const harness = createHarness();

      try {
        const toolService = new ToolService({
          workspaceService: harness.workspaceService
        });
        const targetPath = path.join(harness.workspaceRoot, "outputs", "tool-write.md");
        const result = toolService.runWorkspaceWrite({
          kind: "workspace_write",
          summary: "write tool output",
          targetPath,
          content: "# Tool output\n",
          sourceRequestText: "write tool output",
          requestedAt: new Date().toISOString()
        });

        assert.equal(result.toolName, "workspace-write");
        assert.equal(result.success, true);
        assert.equal(result.output.includes(targetPath), true);
        assert.deepEqual(result.sideEffects, [`wrote:${path.resolve(targetPath)}`]);
        assert.equal(fs.readFileSync(targetPath, "utf8"), "# Tool output\n");
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "WorkspaceService rejects writes outside the workspace root",
    fn: async () => {
      const harness = createHarness();

      try {
        const outsidePath = path.join(harness.tempDir, "outside.md");
        assert.throws(
          () => harness.workspaceService.writeFile(outsidePath, "blocked"),
          /outside the Enso workspace/i
        );
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ToolService returns structured host exec results with captured stdout",
    fn: async () => {
      const harness = createHarness();

      try {
        const hostExecService = new HostExecService(harness.workspaceRoot);
        const toolService = new ToolService({ hostExecService });
        const outputsDir = path.join(harness.workspaceRoot, "outputs");
        fs.mkdirSync(outputsDir, { recursive: true });
        fs.writeFileSync(path.join(outputsDir, "tool-exec.txt"), "tool-exec", "utf8");

        const result = toolService.runHostExec(
          hostExecService.buildHostExecProposal({
            requestText: "Run `Get-Content outputs/tool-exec.txt`",
            command: "Get-Content outputs/tool-exec.txt"
          })
        );

        assert.equal(result.toolName, "exec");
        assert.equal(result.success, true);
        assert.equal(result.output.includes("STDOUT"), true);
        assert.equal(result.output.includes("tool-exec"), true);
        assert.deepEqual(result.sideEffects, ["exec:Get-Content outputs/tool-exec.txt"]);
        assert.equal(result.error, undefined);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "HostExecService times out long-running commands",
    fn: async () => {
      const harness = createHarness();

      try {
        const hostExecService = new HostExecService(harness.workspaceRoot, { timeoutMs: 50 });
        const action = hostExecService.buildHostExecProposal({
          requestText: "Run `Start-Sleep -Seconds 1`",
          command: "Start-Sleep -Seconds 1"
        });
        const result = hostExecService.executePendingAction(action);

        assert.equal(result.timedOut, true);
        assert.equal(result.exitCode, -1);
        assert.equal(result.stderr.includes("timed out"), true);
        assert.equal(hostExecService.verifyPendingAction(result), false);
      } finally {
        harness.cleanup();
      }
    }
  }
];

(async () => {
  let passed = 0;

  for (const entry of tests) {
    if (await runTest(entry.name, entry.fn)) {
      passed += 1;
    }
  }

  if (passed !== tests.length) {
    process.stderr.write(`\n集成测试失败：${passed}/${tests.length} 通过。\n`);
    process.exit(1);
  }

  process.stdout.write(`\n集成测试通过：${passed}/${tests.length} 通过。\n`);
  process.exit(0);
})();
