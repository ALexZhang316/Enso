import { dialog, ipcMain } from "electron";
import { DEFAULT_MODE, ModeId } from "../shared/modes";
import { EnsoConfig, ExecutionInput, InitializationPayload } from "../shared/types";
import { ExecutionFlow } from "./core/execution-flow";
import { ConfigService } from "./services/config-service";
import { KnowledgeService } from "./services/knowledge-service";
import { EnsoStore } from "./services/store";

interface IpcDependencies {
  store: EnsoStore;
  configService: ConfigService;
  knowledgeService: KnowledgeService;
  executionFlow: ExecutionFlow;
}

const buildInitializationPayload = (store: EnsoStore, config: EnsoConfig): InitializationPayload => {
  const currentList = store.listConversations();
  const ensured = currentList.length > 0 ? currentList[0] : store.ensureDefaultConversation();

  const maybeActiveConversationId = store.getActiveConversationId();
  const activeConversation =
    currentList.find((item) => item.id === maybeActiveConversationId) ?? ensured;

  store.setActiveConversationId(activeConversation.id);

  return {
    config,
    conversations: store.listConversations(),
    activeConversationId: activeConversation.id,
    messages: store.listMessages(activeConversation.id),
    state: store.getState(activeConversation.id),
    audit: store.getLatestAudit(activeConversation.id),
    knowledgeSources: store.listKnowledgeSources()
  };
};

export const registerIpcHandlers = ({
  store,
  configService,
  knowledgeService,
  executionFlow
}: IpcDependencies): void => {
  ipcMain.handle("enso:init", () => {
    const config = configService.load();
    return buildInitializationPayload(store, config);
  });

  ipcMain.handle("enso:conversation:create", (_event, title?: string) => {
    const conversation = store.createConversation(DEFAULT_MODE, title?.trim() || "New Conversation");
    store.setActiveConversationId(conversation.id);

    return {
      conversations: store.listConversations(),
      activeConversationId: conversation.id,
      messages: store.listMessages(conversation.id),
      state: store.getState(conversation.id),
      audit: store.getLatestAudit(conversation.id)
    };
  });

  ipcMain.handle("enso:conversation:select", (_event, conversationId: string) => {
    const conversation = store.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found.");
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
    const nextConversation = remaining.length > 0 ? remaining[0] : store.ensureDefaultConversation();

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

  ipcMain.handle("enso:config:save", (_event, config: EnsoConfig) => configService.save(config));

  ipcMain.handle("enso:file:import", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import knowledge files",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Text files", extensions: ["txt", "md", "markdown", "json", "csv"] },
        { name: "All files", extensions: ["*"] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return {
        imported: [],
        skipped: [],
        knowledgeSources: store.listKnowledgeSources()
      };
    }

    const imported = [];
    const skipped = [];

    for (const filePath of result.filePaths) {
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

  ipcMain.handle("enso:request:submit", async (_event, input: ExecutionInput) => {
    const result = await executionFlow.run(input);

    return {
      ...result,
      messages: store.listMessages(input.conversationId),
      conversations: store.listConversations()
    };
  });
};
