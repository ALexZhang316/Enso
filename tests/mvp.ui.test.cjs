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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "enso-ui-kimi-"));
  const userDataDir = path.join(tempRoot, "user-data");
  fs.mkdirSync(userDataDir, { recursive: true });

  let firstApp;
  let firstPage;
  let secondApp;
  let secondPage;

  try {
    ({ electronApp: firstApp, page: firstPage } = await runSession({
      ENSO_USER_DATA_DIR: userDataDir,
      ENSO_TEST_KIMI_RESPONSE: "这是一条来自 Kimi 的测试回复。"
    }));

    await firstPage.getByTestId("layout-root").waitFor();
    await firstPage.getByTestId("nav-settings-button").click();
    await firstPage.getByTestId("settings-provider-select").waitFor();
    await firstPage.getByTestId("settings-provider-model-input").fill("moonshot-v1-8k");
    await firstPage.getByTestId("settings-provider-baseurl-input").fill("https://api.moonshot.cn/v1");
    await firstPage.getByTestId("settings-provider-apikey-input").fill("kimi-ui-test-key");
    await firstPage.getByTestId("settings-save-button").click();
    await firstPage.getByTestId("settings-status").getByText("设置已保存").waitFor();

    await firstPage.getByTestId("nav-settings-button").click();
    await firstPage.getByTestId("composer-input").waitFor();
    await firstPage.getByTestId("composer-input").fill("你好，Kimi。");
    await firstPage.getByTestId("composer-send-button").click();
    await firstPage.getByText("这是一条来自 Kimi 的测试回复。").waitFor();

    await firstApp.close();

    ({ electronApp: secondApp, page: secondPage } = await runSession({
      ENSO_USER_DATA_DIR: userDataDir,
      ENSO_TEST_KIMI_RESPONSE: "第二次启动后的 Kimi 回复。"
    }));

    await secondPage.getByTestId("layout-root").waitFor();
    await secondPage.getByText("你好，Kimi。").waitFor();
    await secondPage.getByText("这是一条来自 Kimi 的测试回复。").waitFor();
    await secondPage.getByTestId("composer-input").fill("请继续。");
    await secondPage.getByTestId("composer-send-button").click();
    await secondPage.getByText("第二次启动后的 Kimi 回复。").waitFor();

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
    if (firstPage) {
      try {
        await firstPage.screenshot({
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
    cleanupDir(tempRoot);
  }
};

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
