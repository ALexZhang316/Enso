import { contextBridge, ipcRenderer } from "electron";
import { EnsoBridge } from "../shared/bridge";
import { ModeId } from "../shared/modes";
import { EnsoConfig, ExecutionInput } from "../shared/types";

const bridge: EnsoBridge = {
  initialize: () => ipcRenderer.invoke("enso:init"),
  createConversation: (title?: string) => ipcRenderer.invoke("enso:conversation:create", title),
  selectConversation: (conversationId: string) => ipcRenderer.invoke("enso:conversation:select", conversationId),
  renameConversation: (conversationId: string, title: string) =>
    ipcRenderer.invoke("enso:conversation:rename", { conversationId, title }),
  deleteConversation: (conversationId: string) => ipcRenderer.invoke("enso:conversation:delete", conversationId),
  togglePinConversation: (conversationId: string) => ipcRenderer.invoke("enso:conversation:toggle-pin", conversationId),
  setMode: (conversationId: string, mode: ModeId) => ipcRenderer.invoke("enso:mode:set", { conversationId, mode }),
  getConfig: () => ipcRenderer.invoke("enso:config:get"),
  saveConfig: (config: EnsoConfig) => ipcRenderer.invoke("enso:config:save", config),
  hasProviderApiKey: (providerId: import("../shared/providers").ProviderId) =>
    ipcRenderer.invoke("enso:provider:key:has", providerId),
  clearProviderApiKey: (providerId: import("../shared/providers").ProviderId) =>
    ipcRenderer.invoke("enso:provider:key:clear", providerId),
  importKnowledgeFiles: () => ipcRenderer.invoke("enso:file:import"),
  retrieveKnowledge: (query: string) => ipcRenderer.invoke("enso:knowledge:retrieve", query),
  listAudits: (conversationId?: string) => ipcRenderer.invoke("enso:audit:list", conversationId),
  resolvePendingConfirmation: (conversationId: string) =>
    ipcRenderer.invoke("enso:confirmation:resolve", conversationId),
  rejectPendingConfirmation: (conversationId: string) =>
    ipcRenderer.invoke("enso:confirmation:reject", conversationId),
  submitRequest: (input: ExecutionInput) => ipcRenderer.invoke("enso:request:submit", input),
  getAppInfo: () => ({
    name: "Enso",
    version: "0.1.0"
  })
};

contextBridge.exposeInMainWorld("enso", bridge);
