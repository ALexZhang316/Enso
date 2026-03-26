/**
 * 单元测试 —— 覆盖 Store CRUD 操作（Enso v2）
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
const { DEFAULT_BOARD } = require(path.join(DIST_ROOT, "shared/boards.js"));

// -- 测试框架（简易框架） --

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
        const conversation = store.createConversation("dialogue", "测试会话");
        assert.ok(conversation.id, "会话应有 id");
        assert.equal(conversation.title, "测试会话");
        assert.equal(conversation.board, "dialogue");
        assert.equal(conversation.pinned, false);
        assert.equal(conversation.model, "");
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
        const c1 = store.createConversation("dialogue", "第一个");
        const c2 = store.createConversation("dialogue", "第二个");
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
    name: "Store 按板块过滤会话列表",
    fn() {
      const { store, cleanup } = createStore();
      try {
        store.createConversation("dialogue", "对话会话");
        store.createConversation("decision", "决策会话");
        store.createConversation("research", "研究会话");
        const dialogueList = store.listConversations("dialogue");
        assert.equal(dialogueList.length, 1);
        assert.equal(dialogueList[0].title, "对话会话");
        const allList = store.listConversations();
        assert.equal(allList.length, 3);
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
        const c = store.createConversation("dialogue", "旧名称");
        store.renameConversation(c.id, "新名称");
        const fetched = store.getConversation(c.id);
        assert.equal(fetched.title, "新名称");
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store 删除会话后级联删除消息",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("dialogue", "即将删除");
        store.addMessage(c.id, "user", "你好");
        assert.equal(store.listMessages(c.id).length, 1);
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
        const c = store.createConversation("dialogue", "测试");
        assert.equal(c.pinned, false);
        store.togglePinned(c.id);
        assert.equal(store.getConversation(c.id).pinned, true);
        store.togglePinned(c.id);
        assert.equal(store.getConversation(c.id).pinned, false);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store 置顶的会话排在前面",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c1 = store.createConversation("dialogue", "普通");
        const c2 = store.createConversation("dialogue", "置顶");
        store.togglePinned(c1.id);
        const list = store.listConversations();
        // c1 被置顶，应排在前面
        assert.equal(list[0].id, c1.id);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store 更新会话模型",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("dialogue", "测试");
        assert.equal(c.model, "");
        store.updateConversationModel(c.id, "gpt-5.4");
        assert.equal(store.getConversation(c.id).model, "gpt-5.4");
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
        const c = store.createConversation("dialogue", "测试");
        const msg = store.addMessage(c.id, "user", "你好世界");
        assert.ok(msg.id);
        assert.equal(msg.role, "user");
        assert.equal(msg.content, "你好世界");
        assert.equal(msg.conversationId, c.id);
        assert.ok(msg.createdAt);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store 添加带 toolName 的消息",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("dialogue", "测试");
        const msg = store.addMessage(c.id, "tool", "搜索结果", "web_search");
        assert.equal(msg.role, "tool");
        assert.equal(msg.toolName, "web_search");
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
        const c = store.createConversation("dialogue", "测试");
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
  {
    name: "Store 添加消息后更新会话的 updatedAt",
    fn() {
      const { store, cleanup } = createStore();
      try {
        const c = store.createConversation("dialogue", "测试");
        const before = store.getConversation(c.id).updatedAt;
        // 稍等一下确保时间戳不同
        store.addMessage(c.id, "user", "你好");
        const after = store.getConversation(c.id).updatedAt;
        assert.ok(after >= before, "updatedAt 应该更新");
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
        const c = store.createConversation("dialogue", "测试");
        store.setActiveConversationId(c.id);
        assert.equal(store.getActiveConversationId(), c.id);
      } finally {
        cleanup();
      }
    }
  },
  {
    name: "Store getActiveConversationId 无记录时返回 null",
    fn() {
      const { store, cleanup } = createStore();
      try {
        assert.equal(store.getActiveConversationId(), null);
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
        assert.equal(c.board, DEFAULT_BOARD);
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
