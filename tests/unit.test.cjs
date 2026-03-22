/**
 * 单元测试 —— 覆盖 Store CRUD 操作
 *
 * 运行方式：npm run test:unit
 * 依赖编译产物（dist/），所以运行前需要 npm run build。
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");

const { EnsoStore } = require(path.join(DIST_ROOT, "main/services/store.js"));
const { DEFAULT_MODE } = require(path.join(DIST_ROOT, "shared/modes.js"));

// -- 测试框架（沿用集成测试的简易框架） --

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

// 创建临时 Store 实例，每个测试独立数据库
const createStore = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enso-unit-"));
  const dbPath = path.join(tempDir, "enso.sqlite");
  const store = new EnsoStore(dbPath);
  return {
    store,
    cleanup() {
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
};

// -- 测试用例 --

const tests = [
  // ==================== Store: 会话 CRUD ====================
  {
    name: "Store 创建会话并返回正确字段",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const conversation = store.createConversation("default", "测试会话");
        assert.ok(conversation.id, "会话应有 id");
        assert.equal(conversation.title, "测试会话");
        assert.equal(conversation.mode, "default");
        assert.equal(conversation.pinned, false);
        assert.ok(conversation.createdAt);
        assert.ok(conversation.updatedAt);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store 列出会话按更新时间降序排列",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c1 = store.createConversation("default", "第一个");
        const c2 = store.createConversation("default", "第二个");
        const list = store.listConversations();
        // 最后创建的排在前面
        assert.equal(list.length, 2);
        assert.equal(list[0].id, c2.id);
        assert.equal(list[1].id, c1.id);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store 重命名会话",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("default", "旧名称");
        store.renameConversation(c.id, "新名称");
        const fetched = store.getConversation(c.id);
        assert.equal(fetched.title, "新名称");
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store 删除会话后级联删除消息和状态",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("default", "即将删除");
        store.addMessage(c.id, "user", "你好");
        // 确认消息和状态存在
        assert.equal(store.listMessages(c.id).length, 1);
        const state = store.getState(c.id);
        assert.equal(state.conversationId, c.id);
        // 删除
        store.deleteConversation(c.id);
        assert.equal(store.getConversation(c.id), null);
        assert.equal(store.listMessages(c.id).length, 0);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store 切换置顶状态",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("default", "测试");
        assert.equal(c.pinned, false);
        store.togglePinnedConversation(c.id);
        assert.equal(store.getConversation(c.id).pinned, true);
        store.togglePinnedConversation(c.id);
        assert.equal(store.getConversation(c.id).pinned, false);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store 设置会话模式",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("default", "测试");
        store.setConversationMode(c.id, "research");
        assert.equal(store.getConversation(c.id).mode, "research");
      } finally {
        cleanup();
      }
    }
  },

  // ==================== Store: 消息 ====================
  {
    name: "Store 添加消息并正确返回",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("default", "测试");
        const msg = store.addMessage(c.id, "user", "你好世界", { custom: true });
        assert.ok(msg.id);
        assert.equal(msg.role, "user");
        assert.equal(msg.content, "你好世界");
        assert.deepEqual(msg.metadata, { custom: true });
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store listRecentMessages 返回最近 N 条消息",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("default", "测试");
        for (let i = 0; i < 5; i++) {
          store.addMessage(c.id, "user", `消息 ${i}`);
        }
        const recent = store.listRecentMessages(c.id, 3);
        assert.equal(recent.length, 3);
        // 最近的消息排在后面（按时间升序返回）
        assert.ok(recent[2].content.includes("4"));
      } finally {
        cleanup();
      }
    }
  },

  // ==================== Store: 状态快照 ====================
  {
    name: "Store getState 对新会话返回默认状态",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("default", "测试");
        const state = store.getState(c.id);
        assert.equal(state.conversationId, c.id);
        assert.equal(state.retrievalUsed, false);
        assert.deepEqual(state.toolsCalled, []);
        assert.equal(state.pendingConfirmation, false);
        assert.equal(state.taskStatus, "idle");
        assert.equal(state.plan, null);
        assert.deepEqual(state.trace, []);
        assert.equal(state.verification, null);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store upsertState 更新并持久化状态",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("default", "测试");
        const updated = store.upsertState({
          conversationId: c.id,
          retrievalUsed: true,
          toolsCalled: ["web_search"],
          latestToolResult: "搜索结果",
          pendingConfirmation: true,
          pendingAction: { kind: "workspace_write", summary: "写入文件", targetPath: "/tmp/test.txt" },
          taskStatus: "awaiting_confirmation",
          updatedAt: new Date().toISOString(),
          plan: { goal: "测试目标", steps: ["步骤1"], likelyTools: [], verificationTarget: "验证" },
          trace: [{ phase: "classify", summary: "分类完成", timestamp: new Date().toISOString() }],
          verification: { status: "passed", detail: "通过" }
        });
        assert.equal(updated.retrievalUsed, true);
        assert.deepEqual(updated.toolsCalled, ["web_search"]);
        assert.equal(updated.pendingConfirmation, true);
        assert.equal(updated.plan.goal, "测试目标");
        assert.equal(updated.verification.status, "passed");
        // 重新读取验证持久化
        const reloaded = store.getState(c.id);
        assert.equal(reloaded.retrievalUsed, true);
        assert.equal(reloaded.plan.goal, "测试目标");
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store resolvePendingConfirmation 清除确认标志",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("default", "测试");
        store.upsertState({
          conversationId: c.id,
          retrievalUsed: false,
          toolsCalled: [],
          latestToolResult: "",
          pendingConfirmation: true,
          pendingAction: { kind: "workspace_write", summary: "写入", targetPath: "/tmp/a.txt" },
          taskStatus: "awaiting_confirmation",
          updatedAt: new Date().toISOString(),
          plan: null,
          trace: [],
          verification: null
        });
        const resolved = store.resolvePendingConfirmation(c.id);
        assert.equal(resolved.pendingConfirmation, false);
        assert.equal(resolved.pendingAction, null);
        assert.equal(resolved.taskStatus, "completed");
      } finally {
        cleanup();
      }
    }
  },

  // ==================== Store: 审计 ====================
  {
    name: "Store 添加审计记录并按会话过滤",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c1 = store.createConversation("default", "会话1");
        const c2 = store.createConversation("default", "会话2");
        store.addAudit({
          conversationId: c1.id,
          mode: "default",
          retrievalUsed: false,
          toolsUsed: [],
          resultType: "answer",
          riskNotes: ""
        });
        store.addAudit({
          conversationId: c2.id,
          mode: "research",
          retrievalUsed: true,
          toolsUsed: ["web_search"],
          resultType: "proposal",
          riskNotes: "外部网络"
        });
        // 全量
        const all = store.listAudits();
        assert.equal(all.length, 2);
        // 按会话
        const c1Audits = store.listAuditsByConversation(c1.id);
        assert.equal(c1Audits.length, 1);
        assert.equal(c1Audits[0].mode, "default");
        // 最新审计
        const latest = store.getLatestAudit(c2.id);
        assert.equal(latest.resultType, "proposal");
        assert.equal(latest.riskNotes, "外部网络");
      } finally {
        cleanup();
      }
    }
  },

  // ==================== Store: 应用状态 (app_state) ====================
  {
    name: "Store 保存和读取活跃会话 ID",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("default", "测试");
        store.setActiveConversationId(c.id);
        assert.equal(store.getActiveConversationId(), c.id);
      } finally {
        cleanup();
      }
    }
  },

  // ==================== Store: 知识库 ====================
  {
    name: "Store 创建知识来源和分块",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const sourceId = store.addKnowledgeSource("测试文档", "/path/to/doc.md");
        assert.ok(sourceId);
        store.insertKnowledgeChunk(sourceId, 0, "第一段内容", { page: 1 });
        store.insertKnowledgeChunk(sourceId, 1, "第二段内容", { page: 2 });
        store.updateKnowledgeSourceChunkCount(sourceId, 2);
        const sources = store.listKnowledgeSources();
        assert.equal(sources.length, 1);
        assert.equal(sources[0].name, "测试文档");
        assert.equal(sources[0].chunkCount, 2);
      } finally {
        cleanup();
      }
    }
  },

  // ==================== Store: ensureDefaultConversation ====================
  {
    name: "Store ensureDefaultConversation 在空库时创建默认会话",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.ensureDefaultConversation();
        assert.ok(c.id);
        assert.equal(c.mode, "default");
        // 再次调用应返回相同会话
        const c2 = store.ensureDefaultConversation();
        assert.equal(c2.id, c.id);
      } finally {
        cleanup();
      }
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
  process.stdout.write(`\n单元测试通过：${passed}/${total} 通过。\n`);
  if (failed > 0) {
    process.exit(1);
  }
})();
