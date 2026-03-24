// Enso v2 Preload — 精简版
// 桥接主进程 IPC 到渲染进程 window.enso

import { contextBridge, ipcRenderer } from "electron";
import { EnsoBridge } from "../shared/bridge";
import { BoardId } from "../shared/boards";
import { ProviderId } from "../shared/providers";
import { EnsoConfig } from "../shared/types";

const bridge: EnsoBridge = {
  // 初始化
  initialize: () => ipcRenderer.invoke("enso:init"),

  // 会话 CRUD
  createConversation: (board: BoardId, title?: string) =>
    ipcRenderer.invoke("enso:conversation:create", board, title),
  selectConversation: (conversationId: string) =>
    ipcRenderer.invoke("enso:conversation:select", conversationId),
  renameConversation: (conversationId: string, title: string) =>
    ipcRenderer.invoke("enso:conversation:rename", { conversationId, title }),
  deleteConversation: (conversationId: string) =>
    ipcRenderer.invoke("enso:conversation:delete", conversationId),
  togglePinConversation: (conversationId: string) =>
    ipcRenderer.invoke("enso:conversation:toggle-pin", conversationId),

  // 配置
  getConfig: () => ipcRenderer.invoke("enso:config:get"),
  saveConfig: (config: EnsoConfig) => ipcRenderer.invoke("enso:config:save", config),
  hasProviderApiKey: (providerId: ProviderId) =>
    ipcRenderer.invoke("enso:provider:key:has", providerId),
  clearProviderApiKey: (providerId: ProviderId) =>
    ipcRenderer.invoke("enso:provider:key:clear", providerId),

  // 聊天
  sendMessage: (params) => ipcRenderer.invoke("enso:chat:send", params),
  cancelStream: (conversationId: string) => ipcRenderer.invoke("enso:chat:cancel", conversationId),

  // 流式事件监听
  onStreamChunk: (callback) => {
    ipcRenderer.on("enso:chat:stream-chunk", (_event, data) => callback(data));
  },
  onStreamEnd: (callback) => {
    ipcRenderer.on("enso:chat:stream-end", (_event, data) => callback(data));
  },
  onStreamError: (callback) => {
    ipcRenderer.on("enso:chat:stream-error", (_event, data) => callback(data));
  },
  removeAllStreamListeners: () => {
    ipcRenderer.removeAllListeners("enso:chat:stream-chunk");
    ipcRenderer.removeAllListeners("enso:chat:stream-end");
    ipcRenderer.removeAllListeners("enso:chat:stream-error");
  },

  // 应用信息
  getAppInfo: () => ({ name: "Enso", version: "0.2.0" })
};

contextBridge.exposeInMainWorld("enso", bridge);
