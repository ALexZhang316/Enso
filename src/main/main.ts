// Enso v2 主进程入口
// 精简：只初始化 store + config + secret + modelAdapter，注册 IPC

import { app, BrowserWindow, nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { registerIpcHandlers } from "./ipc";
import { ConfigService } from "./services/config-service";
import { ModelAdapter } from "./services/model-adapter";
import { SecretService } from "./services/secret-service";
import { EnsoStore } from "./services/store";

let store: EnsoStore | null = null;
let mainWindow: BrowserWindow | null = null;
let creatingWindow = false;
const testUserDataPath = process.env.ENSO_USER_DATA_DIR;

if (testUserDataPath) {
  fs.mkdirSync(testUserDataPath, { recursive: true });
  app.setPath("userData", testUserDataPath);
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

const createMainWindow = async (): Promise<void> => {
  const projectRoot = path.join(__dirname, "..", "..");
  const iconPath = [256, 64]
    .map((s) => path.join(projectRoot, "resources", `icon-${s}.png`))
    .find((p) => fs.existsSync(p));

  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0f172a",
    ...(iconPath ? { icon: nativeImage.createFromPath(iconPath) } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow = window;
  window.on("closed", () => {
    mainWindow = null;
  });
  window.webContents.on("did-fail-load", (_event, code, description) => {
    console.error("Window failed to load:", { code, description });
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      try {
        await window.loadURL(devServerUrl);
        return;
      } catch (error) {
        lastError = error;
        await delay(250);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Failed to connect to dev server.");
  }

  await window.loadFile(path.join(__dirname, "../renderer/index.html"));
};

const ensureMainWindow = async (): Promise<void> => {
  if (creatingWindow || mainWindow) return;
  creatingWindow = true;
  try {
    await createMainWindow();
  } catch (error) {
    console.error("Failed to create window:", error);
    app.quit();
  } finally {
    creatingWindow = false;
  }
};

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath("userData"), "enso.sqlite");
  const configPath = path.join(app.getPath("userData"), "config.toml");
  const secretPath = path.join(app.getPath("userData"), "secrets.json");

  store = new EnsoStore(dbPath);
  const configService = new ConfigService(configPath, app.getAppPath());
  const secretService = new SecretService(secretPath);
  const modelAdapter = new ModelAdapter(secretService);

  registerIpcHandlers({
    store,
    configService,
    modelAdapter,
    secretService,
    getMainWindow: () => mainWindow
  });

  await ensureMainWindow();

  app.on("activate", async () => {
    await ensureMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  store?.close();
  store = null;
});
