const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_MAIN_PATH = path.join(PROJECT_ROOT, "dist", "main", "main.js");
const ARTIFACT_DIR = path.join(PROJECT_ROOT, "output", "playwright");

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const waitForText = async (locator, pattern) => {
  await locator.waitFor({ state: "visible" });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const text = await locator.innerText();
    if (pattern.test(text)) {
      return text;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const latest = await locator.innerText();
  assert.match(latest, pattern);
  return latest;
};

const waitForConversationCount = async (page, expectedMinimum) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const count = await page.locator('[data-testid^="conversation-card-"]').count();
    if (count >= expectedMinimum) {
      return count;
    }

    await page.waitForTimeout(200);
  }

  const finalCount = await page.locator('[data-testid^="conversation-card-"]').count();
  assert.ok(finalCount >= expectedMinimum, `期望至少 ${expectedMinimum} 个会话，实际 ${finalCount} 个`);
  return finalCount;
};

const cleanupDir = (dirPath) => {
  fs.rmSync(dirPath, { recursive: true, force: true });
};

const run = async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "enso-ui-test-"));
  const userDataDir = path.join(tempRoot, "user-data");
  const knowledgeFile = path.join(tempRoot, "alphaorbit.md");

  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(
    knowledgeFile,
    [
      "# AlphaOrbit",
      "",
      "AlphaOrbit is the codename for Enso MVP acceptance.",
      "The system remains read-only by default.",
      "Audit summaries must be visible after each request."
    ].join("\n"),
    "utf8"
  );

  let electronApp;
  let page;

  try {
    electronApp = await electron.launch({
      args: [DIST_MAIN_PATH],
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        ENSO_USER_DATA_DIR: userDataDir,
        ENSO_TEST_IMPORT_FILES: knowledgeFile,
        OPENAI_API_KEY: ""
      }
    });

    page = await electronApp.firstWindow();
    page.setDefaultTimeout(15000);

    await page.getByTestId("layout-root").waitFor();
    await page.getByTestId("left-rail").waitFor();
    await page.getByTestId("center-pane").waitFor();
    await page.getByTestId("right-rail").waitFor();

    await page.getByTestId("mode-button-decision").click();
    await waitForText(page.getByTestId("chat-header-mode"), /模式：决策/);
    await page.getByTestId("mode-button-research").click();
    await waitForText(page.getByTestId("chat-header-mode"), /模式：研究/);

    const initialConversationCount = await page
      .locator('[data-testid^="conversation-card-"]')
      .count();
    await page.getByTestId("conversation-create-button").click();
    await waitForConversationCount(page, initialConversationCount + 1);

    await page.getByTestId("nav-knowledge-button").click();
    await page.getByTestId("knowledge-view").waitFor();
    await page.getByTestId("knowledge-import-button").click();
    await waitForText(page.getByTestId("knowledge-import-status"), /已导入 1 个文件/);
    await page
      .locator('[data-testid^="knowledge-source-"] .font-medium')
      .filter({ hasText: "alphaorbit.md" })
      .first()
      .waitFor();

    await page.getByTestId("nav-settings-button").click();
    await page.getByTestId("settings-style-select").selectOption("direct");
    await page.getByTestId("settings-save-button").click();
    await waitForText(page.getByTestId("settings-status"), /设置已保存/);

    await page.getByTestId("nav-settings-button").click();
    await page.getByTestId("composer-input").waitFor();

    await page.getByTestId("mode-button-research").click();
    await waitForText(page.getByTestId("chat-header-mode"), /模式：研究/);
    await page.getByTestId("composer-retrieval-toggle").check();
    await page.getByTestId("composer-input").fill("请根据 AlphaOrbit 文档 calculate 4 + 5");
    await page.getByTestId("composer-send-button").click();

    await page.getByText("未检测到 API Key").waitFor();
    await waitForText(page.getByTestId("composer-status"), /分类：工具辅助/);
    await waitForText(page.getByTestId("state-panel"), /是否使用检索：是/);
    await waitForText(page.getByTestId("state-panel"), /最近工具结果：4 \+ 5 = 9/);
    await waitForText(page.getByTestId("audit-summary-panel"), /结果类型：回答/);
    await waitForText(page.getByTestId("context-panel"), /AlphaOrbit/);

    await page.getByTestId("composer-input").fill("请删除 alpha.txt 并发送处理结果。");
    await page.getByTestId("composer-send-button").click();
    await page.getByText("受 MVP 只读约束限制，本结果仅作为提案").waitFor();
    await page.getByTestId("resolve-confirmation-button").waitFor();
    await page.getByTestId("resolve-confirmation-button").click();
    await page.getByText("已确认并清除门控。提案已记录，未执行任何外部副作用。").waitFor();

    await page.getByTestId("nav-audits-button").click();
    await page.getByTestId("audit-record-list").waitFor();
    const auditCount = await page.locator('[data-testid^="audit-record-"]').count();
    assert.ok(auditCount >= 2, `期望至少 2 条审计记录，实际 ${auditCount} 条`);
    await page.getByTestId("audit-record-list").getByText("提案").waitFor();

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "mvp-ui-success.png"),
      fullPage: true
    });

    process.stdout.write("MVP UI 自动化测试通过。\n");
  } catch (error) {
    if (page) {
      try {
        await page.screenshot({
          path: path.join(ARTIFACT_DIR, "mvp-ui-failure.png"),
          fullPage: true
        });
      } catch {
        // 截图失败不覆盖原始错误
      }
    }

    throw error;
  } finally {
    if (electronApp) {
      await electronApp.close();
    }
    cleanupDir(tempRoot);
  }
};

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
