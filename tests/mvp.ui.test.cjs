const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_MAIN_PATH = path.join(PROJECT_ROOT, "dist", "main", "main.js");
const ARTIFACT_DIR = path.join(PROJECT_ROOT, "output", "playwright");
const DEFAULT_CONFIG_TOML = fs.readFileSync(path.join(PROJECT_ROOT, "config", "default.toml"), "utf8");

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

const expectActiveMode = async (page, modeId) => {
  await page.getByTestId(`mode-button-${modeId}`).waitFor();
  const active = await page.getByTestId(`mode-button-${modeId}`).getAttribute("aria-pressed");
  assert.equal(active, "true");
};

const run = async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "enso-ui-kimi-"));
  const userDataDir = path.join(tempRoot, "user-data");
  fs.mkdirSync(userDataDir, { recursive: true });
  const invalidRoot = fs.mkdtempSync(path.join(os.tmpdir(), "enso-ui-invalid-config-"));
  const invalidUserDataDir = path.join(invalidRoot, "user-data");
  fs.mkdirSync(invalidUserDataDir, { recursive: true });
  const invalidConfigPath = path.join(invalidUserDataDir, "config.toml");

  let firstApp;
  let firstPage;
  let secondApp;
  let secondPage;
  let invalidApp;
  let invalidPage;

  try {
    fs.writeFileSync(
      invalidConfigPath,
      DEFAULT_CONFIG_TOML.replace('defaultMode = "default"', 'defaultMode = "boom"'),
      "utf8"
    );

    ({ electronApp: invalidApp, page: invalidPage } = await runSession({
      ENSO_USER_DATA_DIR: invalidUserDataDir
    }));

    await invalidPage.getByTestId("init-error-card").waitFor();
    await invalidPage.getByTestId("init-error-message").getByText("config.toml").waitFor();
    await invalidPage.getByTestId("init-error-message").getByText("modeDefaults.defaultMode").waitFor();

    fs.writeFileSync(invalidConfigPath, DEFAULT_CONFIG_TOML, "utf8");
    await invalidPage.getByTestId("init-error-reload-button").click();
    await invalidPage.getByTestId("layout-root").waitFor();
    await invalidPage.getByTestId("mode-button-default").waitFor();

    await invalidApp.close();
    invalidApp = null;
    invalidPage = null;
    cleanupDir(invalidRoot);

    ({ electronApp: firstApp, page: firstPage } = await runSession({
      ENSO_USER_DATA_DIR: userDataDir,
      ENSO_TEST_KIMI_RESPONSE: "# 自动草稿\n\n- 这是一次工作区写入测试。"
    }));

    await firstPage.getByTestId("layout-root").waitFor();
    await firstPage.getByTestId("mode-button-default").waitFor();
    await firstPage.getByTestId("composer-input").fill("Delete the README.md file.");
    await firstPage.getByTestId("composer-send-button").click();
    await firstPage.getByText("当前仅支持工作区内写入提案").waitFor();
    await firstPage.getByTestId("verification-panel").getByText("被拦截").waitFor();
    await firstPage.getByTestId("verification-panel").getByText("unsupported action blocked").waitFor();
    await firstPage.getByTestId("trace-panel").getByText("unsupported action remains blocked").waitFor();
    await firstPage.getByTestId("state-panel").getByText("已完成").waitFor();
    await firstPage.getByTestId("audit-summary-panel").getByText("提案").waitFor();
    await firstPage.getByTestId("audit-summary-panel").getByText("unsupported action blocked").waitFor();
    assert.equal(await firstPage.getByTestId("resolve-confirmation-button").count(), 0);

    const outputsDirForExec = path.join(userDataDir, "workspace", "outputs");
    fs.mkdirSync(outputsDirForExec, { recursive: true });
    fs.writeFileSync(path.join(outputsDirForExec, "ui-exec-safe.txt"), "safe", "utf8");

    await firstPage.getByTestId("composer-input").fill("Run `Get-ChildItem outputs`");
    await firstPage.getByTestId("composer-send-button").click();
    await firstPage.getByText("检测到主机命令执行请求").waitFor();
    await firstPage.getByTestId("pending-action-panel").getByText("Get-ChildItem outputs", { exact: true }).waitFor();
    await firstPage.getByTestId("resolve-confirmation-button").getByText("确认并执行工作区命令").waitFor();
    await firstPage.getByTestId("resolve-confirmation-button").click();
    await firstPage.getByText("已根据确认执行工作区命令").waitFor();
    await firstPage.getByText("ui-exec-safe.txt").waitFor();
    await firstPage.getByTestId("verification-panel").getByText("通过").waitFor();
    await firstPage.getByTestId("state-panel").getByText("exec").waitFor();

    await firstPage.getByTestId("nav-settings-button").click();
    await firstPage.getByTestId("settings-provider-select").waitFor();
    await firstPage.getByTestId("settings-provider-model-input").fill("moonshot-v1-8k");
    await firstPage.getByTestId("settings-provider-baseurl-input").fill("https://api.moonshot.cn/v1");
    await firstPage.getByTestId("settings-provider-apikey-input").fill("kimi-ui-test-key");
    await firstPage.getByTestId("settings-default-mode-select").selectOption("research");
    await firstPage.getByTestId("settings-save-button").click();
    await firstPage.getByTestId("settings-status").getByText("设置已保存").waitFor();

    await firstPage.getByTestId("nav-settings-button").click();
    await firstPage.getByTestId("conversation-create-button").click();
    await expectActiveMode(firstPage, "research");

    await firstPage.getByTestId("composer-input").fill("请写一份测试纪要文件");
    await firstPage.getByTestId("composer-send-button").click();
    await firstPage.getByText("检测到工作区写入请求").waitFor();
    await firstPage.getByTestId("resolve-confirmation-button").click();
    await firstPage.getByText("已根据确认执行工作区写入").waitFor();

    const outputsDir = path.join(userDataDir, "workspace", "outputs");
    const outputFiles = fs.readdirSync(outputsDir);
    assert.equal(outputFiles.length > 0, true);
    const latestOutput = path.join(outputsDir, outputFiles[0]);
    const outputContent = fs.readFileSync(latestOutput, "utf8");
    assert.equal(outputContent.includes("自动草稿"), true);

    await firstApp.close();

    ({ electronApp: secondApp, page: secondPage } = await runSession({
      ENSO_USER_DATA_DIR: userDataDir,
      ENSO_TEST_KIMI_RESPONSE: "# 第二轮草稿\n\n- 持久化检查。"
    }));

    await secondPage.getByTestId("layout-root").waitFor();
    await secondPage.getByTestId("conversation-create-button").click();
    await expectActiveMode(secondPage, "research");

    await secondPage.screenshot({
      path: path.join(ARTIFACT_DIR, "mvp-ui-success.png"),
      fullPage: true
    });

    const configRaw = fs.readFileSync(path.join(userDataDir, "config.toml"), "utf8");
    const secretRaw = fs.readFileSync(path.join(userDataDir, "secrets.json"), "utf8");

    assert.equal(configRaw.includes("kimi-ui-test-key"), false);
    assert.equal(secretRaw.includes("kimi-ui-test-key"), false);

    process.stdout.write("MVP-1 UI 自动化测试通过。\n");
  } catch (error) {
    const failedPage = firstPage ?? invalidPage;
    if (failedPage) {
      try {
        await failedPage.screenshot({
          path: path.join(ARTIFACT_DIR, "mvp-ui-failure.png"),
          fullPage: true
        });
      } catch {}
    }

    throw error;
  } finally {
    if (firstApp) {
      await firstApp.close().catch(() => {});
    }
    if (secondApp) {
      await secondApp.close().catch(() => {});
    }
    if (invalidApp) {
      await invalidApp.close().catch(() => {});
    }
    cleanupDir(tempRoot);
    cleanupDir(invalidRoot);
  }
};

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
