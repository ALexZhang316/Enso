import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { registerIpcHandlers } from "./ipc";
import { ExecutionFlow } from "./core/execution-flow";
import { ConfigService } from "./services/config-service";
import { KnowledgeService } from "./services/knowledge-service";
import { ModelAdapter } from "./services/model-adapter";
import { SecretService } from "./services/secret-service";
import { EnsoStore } from "./services/store";
import { ToolService } from "./services/tool-service";

let store: EnsoStore | null = null;
const windows = new Set<BrowserWindow>();
let creatingWindow = false;
const testUserDataPath = process.env.ENSO_USER_DATA_DIR;

if (testUserDataPath) {
  fs.mkdirSync(testUserDataPath, { recursive: true });
  app.setPath("userData", testUserDataPath);
}

const delay = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection in main process:", reason);
});

const createMainWindow = async (): Promise<void> => {
  const window = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  windows.add(window);
  window.on("closed", () => {
    windows.delete(window);
  });
  window.webContents.on("did-fail-load", (_event, code, description, validatedUrl) => {
    console.error("Main window failed to load:", { code, description, validatedUrl });
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details);
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

    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to connect to dev server URL.");
  }

  await window.loadFile(path.join(__dirname, "../renderer/index.html"));
};

const ensureMainWindow = async (): Promise<void> => {
  if (creatingWindow || windows.size > 0) {
    return;
  }

  creatingWindow = true;
  try {
    await createMainWindow();
  } catch (error) {
    console.error("Failed to create main window:", error);
    app.quit();
    return;
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
  const knowledgeService = new KnowledgeService(store);
  const toolService = new ToolService();
  const secretService = new SecretService(secretPath);
  const modelAdapter = new ModelAdapter(secretService);
  const executionFlow = new ExecutionFlow({
    store,
    configService,
    knowledgeService,
    toolService,
    modelAdapter
  });

  registerIpcHandlers({
    store,
    configService,
    knowledgeService,
    executionFlow,
    secretService
  });

  await ensureMainWindow();

  app.on("activate", async () => {
    await ensureMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  store?.close();
  store = null;
});
