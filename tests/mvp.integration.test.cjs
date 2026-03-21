const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");

const { ConfigService, ConfigValidationError } = require(path.join(DIST_ROOT, "main/services/config-service.js"));
const { ExecutionFlow } = require(path.join(DIST_ROOT, "main/core/execution-flow.js"));
const { HostExecService } = require(path.join(DIST_ROOT, "main/services/host-exec-service.js"));
const { KnowledgeService } = require(path.join(DIST_ROOT, "main/services/knowledge-service.js"));
const { ModelAdapter } = require(path.join(DIST_ROOT, "main/services/model-adapter.js"));
const { SecretService } = require(path.join(DIST_ROOT, "main/services/secret-service.js"));
const { EnsoStore } = require(path.join(DIST_ROOT, "main/services/store.js"));
const { ToolService } = require(path.join(DIST_ROOT, "main/services/tool-service.js"));
const { WorkspaceService } = require(path.join(DIST_ROOT, "main/services/workspace-service.js"));
const { DEFAULT_MODE } = require(path.join(DIST_ROOT, "shared/modes.js"));
const { KimiProvider } = require(path.join(DIST_ROOT, "main/providers/kimi-provider.js"));
const { ProviderError } = require(path.join(DIST_ROOT, "main/providers/types.js"));

const createHarness = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enso-mvp1-test-"));
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
    name: "ExecutionFlow persists a normal Kimi conversation roundtrip",
    fn: async () => {
      const harness = createHarness();
      const restoreFetch = mockKimiReply("这是来自 Kimi 的真实对话链路回复。");

      try {
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
    name: "Workspace write proposals execute after confirmation inside the Enso workspace",
    fn: async () => {
      const harness = createHarness();
      const restoreFetch = mockKimiReply("# 会议纪要\n\n- 已整理关键结论。");

      try {
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
    process.stderr.write(`\nMVP-1 自动化测试失败：${passed}/${tests.length} 通过。\n`);
    process.exit(1);
  }

  process.stdout.write(`\nMVP-1 自动化测试通过：${passed}/${tests.length} 通过。\n`);
  process.exit(0);
})();
