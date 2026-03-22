import { dialog, ipcMain } from "electron";
import path from "node:path";
import { ModeId } from "../shared/modes";
import { EnsoConfig, ExecutionInput, InitializationPayload } from "../shared/types";
import { ExecutionFlow } from "./core/execution-flow";
import { ConfigService } from "./services/config-service";
import { KnowledgeService } from "./services/knowledge-service";
import { SecretService } from "./services/secret-service";
import { EnsoStore } from "./services/store";
import { WorkspaceService } from "./services/workspace-service";

interface IpcDependencies {
  store: EnsoStore;
  configService: ConfigService;
  knowledgeService: KnowledgeService;
  executionFlow: ExecutionFlow;
  secretService: SecretService;
  workspaceService: WorkspaceService;
}

const buildInitializationPayload = (
  store: EnsoStore,
  config: EnsoConfig,
  workspaceService: WorkspaceService
): InitializationPayload => {
  const currentList = store.listConversations();
  const ensured =
    currentList.length > 0 ? currentList[0] : store.ensureDefaultConversation(config.modeDefaults.defaultMode);

  const maybeActiveConversationId = store.getActiveConversationId();
  const activeConversation = currentList.find((item) => item.id === maybeActiveConversationId) ?? ensured;

  store.setActiveConversationId(activeConversation.id);

  return {
    config,
    conversations: store.listConversations(),
    activeConversationId: activeConversation.id,
    messages: store.listMessages(activeConversation.id),
    state: store.getState(activeConversation.id),
    audit: store.getLatestAudit(activeConversation.id),
    knowledgeSources: store.listKnowledgeSources(),
    workspaceRoot: workspaceService.getRootPath()
  };
};

export const registerIpcHandlers = ({
  store,
  configService,
  knowledgeService,
  executionFlow,
  secretService,
  workspaceService
}: IpcDependencies): void => {
  ipcMain.handle("enso:init", () => {
    const config = configService.load();
    return buildInitializationPayload(store, config, workspaceService);
  });

  ipcMain.handle("enso:conversation:create", (_event, title?: string) => {
    const config = configService.load();
    const conversation = store.createConversation(config.modeDefaults.defaultMode, title?.trim() || "新会话");
    store.setActiveConversationId(conversation.id);

    return {
      conversations: store.listConversations(),
      activeConversationId: conversation.id,
      messages: store.listMessages(conversation.id),
      state: store.getState(conversation.id),
      audit: store.getLatestAudit(conversation.id),
      mode: conversation.mode
    };
  });

  ipcMain.handle("enso:conversation:select", (_event, conversationId: string) => {
    const conversation = store.getConversation(conversationId);
    if (!conversation) {
      throw new Error("未找到该会话。");
    }

    store.setActiveConversationId(conversationId);

    return {
      activeConversationId: conversationId,
      messages: store.listMessages(conversationId),
      state: store.getState(conversationId),
      audit: store.getLatestAudit(conversationId),
      mode: conversation.mode
    };
  });

  ipcMain.handle("enso:conversation:rename", (_event, payload: { conversationId: string; title: string }) => {
    store.renameConversation(payload.conversationId, payload.title.trim());
    return store.listConversations();
  });

  ipcMain.handle("enso:conversation:delete", (_event, conversationId: string) => {
    store.deleteConversation(conversationId);

    const remaining = store.listConversations();
    const config = configService.load();
    const nextConversation =
      remaining.length > 0 ? remaining[0] : store.ensureDefaultConversation(config.modeDefaults.defaultMode);

    store.setActiveConversationId(nextConversation.id);

    return {
      conversations: store.listConversations(),
      activeConversationId: nextConversation.id,
      messages: store.listMessages(nextConversation.id),
      state: store.getState(nextConversation.id),
      audit: store.getLatestAudit(nextConversation.id),
      mode: nextConversation.mode
    };
  });

  ipcMain.handle("enso:conversation:toggle-pin", (_event, conversationId: string) => {
    store.togglePinnedConversation(conversationId);
    return store.listConversations();
  });

  ipcMain.handle("enso:mode:set", (_event, payload: { conversationId: string; mode: ModeId }) => {
    store.setConversationMode(payload.conversationId, payload.mode);
    return store.getConversation(payload.conversationId);
  });

  ipcMain.handle("enso:config:get", () => configService.load());

  ipcMain.handle("enso:config:save", (_event, config: EnsoConfig) => {
    const apiKey = config.provider.apiKey?.trim();
    if (apiKey) {
      secretService.saveProviderApiKey(config.provider.provider, apiKey);
    }

    return configService.save({
      ...config,
      provider: {
        ...config.provider,
        apiKey: ""
      }
    });
  });

  ipcMain.handle("enso:provider:key:has", (_event, providerId: EnsoConfig["provider"]["provider"]) =>
    secretService.hasProviderApiKey(providerId)
  );

  ipcMain.handle("enso:provider:key:clear", (_event, providerId: EnsoConfig["provider"]["provider"]) => {
    secretService.clearProviderApiKey(providerId);
    return true;
  });

  ipcMain.handle("enso:file:import", async () => {
    const scriptedImportPaths = process.env.ENSO_TEST_IMPORT_FILES?.split(path.delimiter)
      .map((item) => item.trim())
      .filter(Boolean);

    const filePaths =
      scriptedImportPaths && scriptedImportPaths.length > 0
        ? scriptedImportPaths
        : (
            await dialog.showOpenDialog({
              title: "导入知识文件",
              properties: ["openFile", "multiSelections"],
              filters: [
                { name: "文本文件", extensions: ["txt", "md", "markdown", "json", "csv"] },
                { name: "所有文件", extensions: ["*"] }
              ]
            })
          ).filePaths;

    if (filePaths.length === 0) {
      return {
        imported: [],
        skipped: [],
        knowledgeSources: store.listKnowledgeSources()
      };
    }

    const imported = [];
    const skipped = [];

    for (const filePath of filePaths) {
      try {
        const source = await knowledgeService.ingestFile(filePath);
        imported.push(source);
      } catch {
        skipped.push(filePath);
      }
    }

    return {
      imported,
      skipped,
      knowledgeSources: store.listKnowledgeSources()
    };
  });

  ipcMain.handle("enso:knowledge:retrieve", (_event, query: string) => {
    return knowledgeService.retrieve(query, 5);
  });

  ipcMain.handle("enso:audit:list", (_event, conversationId?: string) => {
    if (conversationId) {
      return store.listAuditsByConversation(conversationId, 120);
    }

    return store.listAudits(120);
  });

  ipcMain.handle("enso:confirmation:resolve", (_event, conversationId: string) => {
    const conversation = store.getConversation(conversationId);
    if (!conversation) {
      throw new Error("未找到该会话。");
    }

    const result = executionFlow.resolvePendingAction(conversationId);

    return {
      messages: store.listMessages(conversationId),
      state: result.state,
      audit: result.audit
    };
  });

  ipcMain.handle("enso:request:submit", async (_event, input: ExecutionInput) => {
    const result = await executionFlow.run(input);

    return {
      ...result,
      messages: store.listMessages(input.conversationId),
      conversations: store.listConversations()
    };
  });
};
