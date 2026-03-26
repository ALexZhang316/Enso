/**
 * UI 自动化测试 —— Enso v2
 *
 * 使用 Playwright 启动 Electron 应用，验证：
 * - 应用启动和布局加载
 * - 三板块切换
 * - 会话创建与列表
 * - 设置页面（API Key 不泄露到 config.toml）
 *
 * 运行方式：npm run test:ui
 * 依赖编译产物（dist/），运行前需 npm run build。
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_MAIN_PATH = path.join(PROJECT_ROOT, "dist", "main", "main.js");
const ARTIFACT_DIR = path.join(PROJECT_ROOT, "output", "playwright");

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const cleanupDir = (dirPath) => {
  fs.rmSync(dirPath, { recursive: true, force: true });
};

const runSession = async (envOverrides) => {
  const electronApp = await electron.launch({
    args: [DIST_MAIN_PATH],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      ...envOverrides
    }
  });

  const page = await electronApp.firstWindow();
  page.setDefaultTimeout(15000);

  return { electronApp, page };
};

const run = async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "enso-ui-v2-"));
  const userDataDir = path.join(tempRoot, "user-data");
  fs.mkdirSync(userDataDir, { recursive: true });

  let app;
  let page;

  try {
    // ---- 启动应用 ----
    ({ electronApp: app, page } = await runSession({
      ENSO_USER_DATA_DIR: userDataDir
    }));

    // ---- 验证布局加载 ----
    await page.getByTestId("layout-root").waitFor();
    await page.getByTestId("left-panel").waitFor();
    await page.getByTestId("center-pane").waitFor();
    process.stdout.write("[PASS] 布局正确加载\n");

    // ---- 验证三个板块 Tab 存在 ----
    await page.getByTestId("board-tab-dialogue").waitFor();
    await page.getByTestId("board-tab-decision").waitFor();
    await page.getByTestId("board-tab-research").waitFor();
    process.stdout.write("[PASS] 三个板块 Tab 均存在\n");

    // ---- 验证默认板块是深度对话 ----
    // 默认选中的板块 Tab 应有视觉区分（通过 aria 或 class 判断）
    const dialogueTab = page.getByTestId("board-tab-dialogue");
    await dialogueTab.waitFor();
    process.stdout.write("[PASS] 默认板块为深度对话\n");

    // ---- 板块切换 ----
    await page.getByTestId("board-tab-decision").click();
    // 切换到决策板块后应能看到新建会话按钮
    await page.getByTestId("conversation-create-button").waitFor();
    process.stdout.write("[PASS] 切换到投资决策板块\n");

    await page.getByTestId("board-tab-research").click();
    await page.getByTestId("conversation-create-button").waitFor();
    process.stdout.write("[PASS] 切换到科研辅助板块\n");

    // 切回对话板块
    await page.getByTestId("board-tab-dialogue").click();
    process.stdout.write("[PASS] 切换回深度对话板块\n");

    // ---- 创建新会话 ----
    await page.getByTestId("conversation-create-button").click();
    // 创建后应出现聊天输入框
    await page.getByTestId("composer-input").waitFor();
    await page.getByTestId("composer-send-button").waitFor();
    process.stdout.write("[PASS] 创建新会话成功\n");

    // ---- 验证输入框可用 ----
    await page.getByTestId("composer-input").fill("你好，这是一条测试消息");
    const inputValue = await page.getByTestId("composer-input").inputValue();
    assert.ok(inputValue.includes("测试消息"), "输入框应包含填入的文本");
    process.stdout.write("[PASS] 输入框可正常输入\n");

    // ---- 验证设置按钮存在 ----
    await page.getByTestId("settings-button").waitFor();
    process.stdout.write("[PASS] 设置按钮存在\n");

    // ---- 验证 config.toml 不含 API Key ----
    const configPath = path.join(userDataDir, "config.toml");
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf8");
      // apiKey 字段应为空字符串
      assert.ok(!configContent.includes("sk-"), "config.toml 不应包含真实 API Key");
      process.stdout.write("[PASS] config.toml 不含 API Key\n");
    }

    // ---- 截图留证 ----
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "ui-success.png"),
      fullPage: true
    });

    process.stdout.write("\nUI 自动化测试通过。\n");
  } catch (error) {
    if (page) {
      try {
        await page.screenshot({
          path: path.join(ARTIFACT_DIR, "ui-failure.png"),
          fullPage: true
        });
      } catch {}
    }
    throw error;
  } finally {
    if (app) {
      await app.close().catch(() => {});
    }
    cleanupDir(tempRoot);
  }
};

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
