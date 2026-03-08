const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");
const TEST_API_ENV = "ENSO_TEST_MISSING_KEY";

const { ConfigService } = require(path.join(DIST_ROOT, "main/services/config-service.js"));
const { ExecutionFlow } = require(path.join(DIST_ROOT, "main/core/execution-flow.js"));
const { KnowledgeService } = require(path.join(DIST_ROOT, "main/services/knowledge-service.js"));
const { ModelAdapter } = require(path.join(DIST_ROOT, "main/services/model-adapter.js"));
const { EnsoStore } = require(path.join(DIST_ROOT, "main/services/store.js"));
const { ToolService } = require(path.join(DIST_ROOT, "main/services/tool-service.js"));

const createHarness = () => {
  delete process.env[TEST_API_ENV];

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enso-mvp-test-"));
  const dbPath = path.join(tempDir, "enso.sqlite");
  const configPath = path.join(tempDir, "config.toml");
  const store = new EnsoStore(dbPath);
  const configService = new ConfigService(configPath, PROJECT_ROOT);
  const baseConfig = configService.load();

  configService.save({
    ...baseConfig,
    provider: {
      ...baseConfig.provider,
      apiKeyEnv: TEST_API_ENV
    }
  });

  const knowledgeService = new KnowledgeService(store);
  const toolService = new ToolService();
  const modelAdapter = new ModelAdapter();
  const executionFlow = new ExecutionFlow({
    store,
    configService,
    knowledgeService,
    toolService,
    modelAdapter
  });

  return {
    tempDir,
    dbPath,
    configPath,
    store,
    configService,
    knowledgeService,
    executionFlow,
    close() {
      store.close();
    },
    cleanup() {
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
};

const writeFixture = (dirPath, fileName, content) => {
  const filePath = path.join(dirPath, fileName);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
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

const tests = [
  {
    name: "ConfigService 会创建并保存本地配置",
    fn: async () => {
      const harness = createHarness();

      try {
        assert.equal(fs.existsSync(harness.configPath), true);

        const currentConfig = harness.configService.load();
        const saved = harness.configService.save({
          ...currentConfig,
          expression: {
            ...currentConfig.expression,
            style: "direct",
            defaultAssumption: "conservative"
          }
        });

        const reloaded = harness.configService.load();

        assert.equal(saved.expression.style, "direct");
        assert.equal(reloaded.expression.style, "direct");
        assert.equal(reloaded.expression.defaultAssumption, "conservative");
        assert.equal(reloaded.provider.apiKeyEnv, TEST_API_ENV);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "EnsoStore 会持久化会话、消息、状态与审计摘要",
    fn: async () => {
      const harness = createHarness();
      const conversation = harness.store.createConversation("decision", "自动化测试会话");

      harness.store.addMessage(conversation.id, "user", "这是第一条消息。", {
        source: "mvp-test"
      });

      harness.store.upsertState({
        conversationId: conversation.id,
        retrievalUsed: true,
        toolsCalled: ["search"],
        latestToolResult: "命中 1 条知识片段。",
        pendingConfirmation: false,
        taskStatus: "completed",
        updatedAt: new Date().toISOString()
      });

      harness.store.addAudit({
        conversationId: conversation.id,
        mode: "decision",
        retrievalUsed: true,
        toolsUsed: ["search"],
        resultType: "answer",
        riskNotes: "测试审计"
      });

      harness.close();

      const reopened = new EnsoStore(harness.dbPath);

      try {
        const storedConversation = reopened.getConversation(conversation.id);
        const messages = reopened.listMessages(conversation.id);
        const state = reopened.getState(conversation.id);
        const audit = reopened.getLatestAudit(conversation.id);

        assert.equal(storedConversation?.title, "自动化测试会话");
        assert.equal(messages.length, 1);
        assert.equal(messages[0].content, "这是第一条消息。");
        assert.equal(state.retrievalUsed, true);
        assert.deepEqual(state.toolsCalled, ["search"]);
        assert.equal(audit?.riskNotes, "测试审计");
      } finally {
        reopened.close();
        fs.rmSync(harness.tempDir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "KnowledgeService 会导入文件、切块并返回相关检索结果",
    fn: async () => {
      const harness = createHarness();

      try {
        const knowledgeFile = writeFixture(
          harness.tempDir,
          "project-notes.md",
          [
            "# AlphaOrbit",
            "",
            "AlphaOrbit is the codename for the Enso MVP rollout.",
            "The audit gate must remain read-only by default.",
            "Research mode should surface local evidence before answering."
          ].join("\n")
        );

        const source = await harness.knowledgeService.ingestFile(knowledgeFile);
        const snippets = harness.knowledgeService.retrieve("请查找 AlphaOrbit 的本地证据", 3);

        assert.equal(source.name, "project-notes.md");
        assert.equal(source.chunkCount > 0, true);
        assert.equal(snippets.length > 0, true);
        assert.equal(snippets[0].sourceName, "project-notes.md");
        assert.match(snippets[0].content, /AlphaOrbit/);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow 会跑通检索加计算主链并写回状态",
    fn: async () => {
      const harness = createHarness();

      try {
        const conversation = harness.store.createConversation("research", "执行流测试");
        const knowledgeFile = writeFixture(
          harness.tempDir,
          "evidence.md",
          [
            "AlphaOrbit keeps all MVP state local.",
            "The system must write audit summaries after each request."
          ].join("\n")
        );

        await harness.knowledgeService.ingestFile(knowledgeFile);

        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "research",
          text: "请根据 AlphaOrbit 文档 calculate 2 + 3 * 4",
          enableRetrievalForTurn: true
        });

        const messages = harness.store.listMessages(conversation.id);
        const audit = harness.store.getLatestAudit(conversation.id);

        assert.equal(result.classification.handlingClass, "tool-assisted");
        assert.equal(result.classification.retrievalNeeded, true);
        assert.equal(result.classification.toolNeeded, true);
        assert.equal(result.retrievedSnippets.length > 0, true);
        assert.equal(result.state.retrievalUsed, true);
        assert.deepEqual(result.state.toolsCalled, ["compute"]);
        assert.equal(messages.length, 2);
        assert.match(messages[1].content, /工具摘要：2 \+ 3 \* 4 = 14/);
        assert.match(messages[1].content, /检索证据来源：evidence\.md/);
        assert.equal(audit?.resultType, "answer");
        assert.deepEqual(audit?.toolsUsed, ["compute"]);
      } finally {
        harness.cleanup();
      }
    }
  },
  {
    name: "ExecutionFlow 会对动作型请求应用只读门控",
    fn: async () => {
      const harness = createHarness();

      try {
        const conversation = harness.store.createConversation("decision", "门控测试");

        const result = await harness.executionFlow.run({
          conversationId: conversation.id,
          mode: "decision",
          text: "请删除 alpha.txt 并发送处理结果。",
          enableRetrievalForTurn: false
        });

        const resolved = harness.store.resolvePendingConfirmation(conversation.id);
        const messages = harness.store.listMessages(conversation.id);

        assert.equal(result.classification.handlingClass, "action-adjacent");
        assert.equal(result.state.pendingConfirmation, true);
        assert.equal(result.state.taskStatus, "awaiting_confirmation");
        assert.equal(result.audit.resultType, "proposal");
        assert.match(messages[1].content, /受 MVP 只读约束限制，本结果仅作为提案/);
        assert.equal(resolved.pendingConfirmation, false);
        assert.equal(resolved.taskStatus, "completed");
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
    process.stderr.write(`\nMVP 自动化测试失败：${passed}/${tests.length} 通过。\n`);
    process.exit(1);
  }

  process.stdout.write(`\nMVP 自动化测试通过：${passed}/${tests.length} 通过。\n`);
  process.exit(0);
})();
