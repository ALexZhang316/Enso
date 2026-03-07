import { app, BrowserWindow } from "electron";
import path from "node:path";
import { registerIpcHandlers } from "./ipc";
import { ExecutionFlow } from "./core/execution-flow";
import { ConfigService } from "./services/config-service";
import { KnowledgeService } from "./services/knowledge-service";
import { ModelAdapter } from "./services/model-adapter";
import { EnsoStore } from "./services/store";
import { ToolService } from "./services/tool-service";

let store: EnsoStore | null = null;

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

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await window.loadURL(devServerUrl);
    return;
  }

  await window.loadFile(path.join(__dirname, "../renderer/index.html"));
};

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath("userData"), "enso.sqlite");
  const configPath = path.join(app.getPath("userData"), "config.toml");

  store = new EnsoStore(dbPath);
  const configService = new ConfigService(configPath, app.getAppPath());
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

  registerIpcHandlers({
    store,
    configService,
    knowledgeService,
    executionFlow
  });

  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  store = null;
});
