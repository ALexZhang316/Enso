// Enso v2 IPC 处理器 — 极简版
// 删除了知识库、审计、确认/拒绝、执行流水线等旧通道

import { ipcMain, BrowserWindow } from "electron";
import { BoardId, DEFAULT_BOARD, getBoardDef } from "../shared/boards";
import { ProviderId } from "../shared/providers";
import { EnsoConfig, InitializationPayload } from "../shared/types";
import { ConfigService } from "./services/config-service";
import { ModelAdapter } from "./services/model-adapter";
import { SecretService } from "./services/secret-service";
import { EnsoStore } from "./services/store";

interface IpcDependencies {
  store: EnsoStore;
  configService: ConfigService;
  modelAdapter: ModelAdapter;
  secretService: SecretService;
  getMainWindow: () => BrowserWindow | null;
}

// 追踪正在进行的流式请求，用于取消
const activeStreams = new Map<string, AbortController>();

const buildInitPayload = (store: EnsoStore, config: EnsoConfig): InitializationPayload => {
  const conversations = store.listConversations();
  const savedActiveId = store.getActiveConversationId();
  const active = conversations.find((c) => c.id === savedActiveId) ?? conversations[0] ?? store.ensureDefaultConversation(DEFAULT_BOARD);
  store.setActiveConversationId(active.id);

  return {
    config,
    conversations: store.listConversations(),
    activeConversationId: active.id,
    messages: store.listMessages(active.id)
  };
};

export const registerIpcHandlers = ({
  store,
  configService,
  modelAdapter,
  secretService,
  getMainWindow
}: IpcDependencies): void => {
  // 初始化
  ipcMain.handle("enso:init", () => {
    const config = configService.load();
    return buildInitPayload(store, config);
  });

  // 创建会话
  ipcMain.handle("enso:conversation:create", (_event, board: BoardId, title?: string) => {
    const conversation = store.createConversation(board, title?.trim() || "新会话");
    store.setActiveConversationId(conversation.id);
    return {
      conversations: store.listConversations(),
      activeConversationId: conversation.id,
      messages: store.listMessages(conversation.id)
    };
  });

  // 选择会话
  ipcMain.handle("enso:conversation:select", (_event, conversationId: string) => {
    const conversation = store.getConversation(conversationId);
    if (!conversation) throw new Error("未找到该会话。");
    store.setActiveConversationId(conversationId);
    return {
      activeConversationId: conversationId,
      messages: store.listMessages(conversationId)
    };
  });

  // 重命名
  ipcMain.handle("enso:conversation:rename", (_event, payload: { conversationId: string; title: string }) => {
    store.renameConversation(payload.conversationId, payload.title.trim());
    return store.listConversations();
  });

  // 删除
  ipcMain.handle("enso:conversation:delete", (_event, conversationId: string) => {
    store.deleteConversation(conversationId);
    const remaining = store.listConversations();
    const next = remaining.length > 0 ? remaining[0] : store.ensureDefaultConversation(DEFAULT_BOARD);
    store.setActiveConversationId(next.id);
    return {
      conversations: store.listConversations(),
      activeConversationId: next.id,
      messages: store.listMessages(next.id)
    };
  });

  // 置顶
  ipcMain.handle("enso:conversation:toggle-pin", (_event, conversationId: string) => {
    store.togglePinned(conversationId);
    return store.listConversations();
  });

  // 配置
  ipcMain.handle("enso:config:get", () => configService.load());

  ipcMain.handle("enso:config:save", (_event, config: EnsoConfig) => {
    // 保存每个提供商的 API Key 到安全存储
    for (const [pid, pconfig] of Object.entries(config.providers)) {
      const key = pconfig.apiKey?.trim();
      if (key) {
        secretService.saveProviderApiKey(pid as ProviderId, key);
      }
    }
    // 清除 apiKey 后保存到配置文件
    const cleaned = { ...config };
    cleaned.providers = { ...config.providers };
    for (const pid of Object.keys(cleaned.providers) as ProviderId[]) {
      cleaned.providers[pid] = { ...cleaned.providers[pid], apiKey: "" };
    }
    return configService.save(cleaned);
  });

  ipcMain.handle("enso:provider:key:has", (_event, providerId: ProviderId) =>
    secretService.hasProviderApiKey(providerId)
  );

  ipcMain.handle("enso:provider:key:clear", (_event, providerId: ProviderId) => {
    secretService.clearProviderApiKey(providerId);
    return true;
  });

  // 发送消息（流式）
  ipcMain.handle(
    "enso:chat:send",
    async (
      _event,
      params: {
        conversationId: string;
        board: BoardId;
        text: string;
        providerId: ProviderId;
        model: string;
      }
    ) => {
      const { conversationId, board, text, providerId, model } = params;
      const window = getMainWindow();
      if (!window) return;

      // 保存用户消息到数据库
      store.addMessage(conversationId, "user", text);
      // 记录使用的模型
      store.updateConversationModel(conversationId, model);

      // 获取历史消息
      const boardDef = getBoardDef(board);
      const recentMessages = store.listRecentMessages(conversationId, boardDef.historyWindow);

      // 构建发给模型的消息（排除 tool 角色消息，简化处理）
      const chatMessages = recentMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content
        }));

      // 创建 AbortController 用于取消
      const controller = new AbortController();
      activeStreams.set(conversationId, controller);

      try {
        await modelAdapter.streamChat({
          providerId,
          model,
          board,
          messages: chatMessages,
          abortSignal: controller.signal,
          callbacks: {
            onChunk: (delta) => {
              if (!window.isDestroyed()) {
                window.webContents.send("enso:chat:stream-chunk", { conversationId, delta });
              }
            },
            onDone: (fullText) => {
              // 保存助手回复到数据库
              const msg = store.addMessage(conversationId, "assistant", fullText);
              if (!window.isDestroyed()) {
                window.webContents.send("enso:chat:stream-end", {
                  conversationId,
                  fullText,
                  messageId: msg.id
                });
              }
            },
            onError: (error) => {
              if (!window.isDestroyed()) {
                window.webContents.send("enso:chat:stream-error", { conversationId, error });
              }
            }
          }
        });
      } finally {
        activeStreams.delete(conversationId);
      }
    }
  );

  // 取消流式响应
  ipcMain.handle("enso:chat:cancel", (_event, conversationId: string) => {
    const controller = activeStreams.get(conversationId);
    if (controller) {
      controller.abort();
      activeStreams.delete(conversationId);
    }
  });
};
