import { useEffect, useMemo, useState } from "react";
import { DEFAULT_MODE, MODES, ModeId } from "@shared/modes";
import { ProviderId } from "@shared/providers";
import {
  AuditSummary,
  ChatMessage,
  Conversation,
  EnsoConfig,
  RetrievedSnippet,
  StateSnapshot,
  KnowledgeSource
} from "@shared/types";
import { Button } from "@renderer/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { boolLabel, handlingClassLabel } from "@renderer/lib/labels";
import LeftPanel, { CenterView } from "@renderer/components/LeftPanel";
import CenterPanel from "@renderer/components/CenterPanel";
import RightPanel from "@renderer/components/RightPanel";

// -- 工具函数 --

const defaultState = (conversationId: string): StateSnapshot => ({
  conversationId,
  retrievalUsed: false,
  toolsCalled: [],
  latestToolResult: "",
  pendingConfirmation: false,
  pendingAction: null,
  taskStatus: "idle",
  updatedAt: new Date().toISOString(),
  plan: null,
  trace: [],
  verification: null
});

const isRetrievedSnippet = (value: unknown): value is RetrievedSnippet =>
  Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { sourceName?: unknown }).sourceName === "string" &&
    typeof (value as { sourcePath?: unknown }).sourcePath === "string" &&
    typeof (value as { content?: unknown }).content === "string" &&
    typeof (value as { score?: unknown }).score === "number"
  );

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

// -- 主组件 --

const App = (): JSX.Element => {
  const appInfo = window.enso.getAppInfo();

  // -- 状态 --
  const [isLoading, setIsLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [config, setConfig] = useState<EnsoConfig | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [activeMode, setActiveMode] = useState<ModeId>(DEFAULT_MODE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stateSnapshot, setStateSnapshot] = useState<StateSnapshot>(defaultState(""));
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [workspaceRoot, setWorkspaceRoot] = useState<string>("");
  const [auditRecords, setAuditRecords] = useState<AuditSummary[]>([]);
  const [importStatus, setImportStatus] = useState<string>("");
  const [composerText, setComposerText] = useState<string>("");
  const [enableRetrievalForTurn, setEnableRetrievalForTurn] = useState<boolean>(false);
  const [lastRunInfo, setLastRunInfo] = useState<string>("");
  const [centerView, setCenterView] = useState<CenterView>("chat");
  const [settingsDraft, setSettingsDraft] = useState<EnsoConfig | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<string>("");
  const [providerApiKeyDraft, setProviderApiKeyDraft] = useState<string>("");
  const [hasStoredApiKey, setHasStoredApiKey] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [auditFilterCurrentConversation, setAuditFilterCurrentConversation] = useState<boolean>(true);

  // -- 派生状态 --

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );

  const activeModeDescription = useMemo(
    () => MODES.find((mode) => mode.id === activeMode)?.description ?? "",
    [activeMode]
  );

  const latestRetrievedSnippets = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== "assistant" || !message.metadata) continue;
      const raw = (message.metadata as Record<string, unknown>).retrievedSnippets;
      if (Array.isArray(raw)) return raw.filter(isRetrievedSnippet);
      if ((message.metadata as Record<string, unknown>).retrievalUsed === true) return [] as RetrievedSnippet[];
    }
    return [] as RetrievedSnippet[];
  }, [messages]);

  // -- 内部操作 --

  const loadAuditRecords = async (conversationId?: string): Promise<void> => {
    const records = await window.enso.listAudits(conversationId);
    setAuditRecords(records);
  };

  const refreshProviderApiKeyStatus = async (providerId: ProviderId): Promise<void> => {
    const hasKey = await window.enso.hasProviderApiKey(providerId);
    setHasStoredApiKey(hasKey);
  };

  const toggleCenterView = (next: CenterView): void => {
    setCenterView((prev) => (prev === next ? "chat" : next));
  };

  // -- 生命周期 --

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      try {
        const payload = await window.enso.initialize();
        setInitializationError("");
        setConfig(payload.config);
        setConversations(payload.conversations);
        setActiveConversationId(payload.activeConversationId);
        setMessages(payload.messages);
        setStateSnapshot(payload.state);
        setAuditSummary(payload.audit);
        setKnowledgeSources(payload.knowledgeSources);
        setWorkspaceRoot(payload.workspaceRoot);
        setSettingsDraft(payload.config);
        await refreshProviderApiKeyStatus(payload.config.provider.provider);
        const activeConversationMode =
          payload.conversations.find((item) => item.id === payload.activeConversationId)?.mode ??
          payload.config.modeDefaults.defaultMode;
        setActiveMode(activeConversationMode);
        await loadAuditRecords(payload.activeConversationId);
      } catch (error) {
        setInitializationError(toErrorMessage(error, "初始化失败。"));
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap().catch(() => {
      setInitializationError("初始化失败。");
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (config) {
      setSettingsDraft(config);
      setProviderApiKeyDraft("");
    }
  }, [config]);

  useEffect(() => {
    if (!activeConversationId) return;
    const conversationId = auditFilterCurrentConversation ? activeConversationId : undefined;
    loadAuditRecords(conversationId).catch(() => setAuditRecords([]));
  }, [activeConversationId, auditFilterCurrentConversation]);

  // -- 事件处理 --

  const handleCreateConversation = async (): Promise<void> => {
    const payload = await window.enso.createConversation();
    setConversations(payload.conversations);
    setActiveConversationId(payload.activeConversationId);
    setMessages(payload.messages);
    setStateSnapshot(payload.state);
    setAuditSummary(payload.audit);
    setActiveMode(payload.mode ?? config?.modeDefaults.defaultMode ?? DEFAULT_MODE);
    setComposerText("");
    setLastRunInfo("");
    setSubmitError("");
    setCenterView("chat");
    await loadAuditRecords(payload.activeConversationId);
  };

  const handleSelectConversation = async (conversationId: string): Promise<void> => {
    const payload = await window.enso.selectConversation(conversationId);
    setActiveConversationId(payload.activeConversationId);
    setMessages(payload.messages);
    setStateSnapshot(payload.state);
    setAuditSummary(payload.audit);
    setLastRunInfo("");
    setSubmitError("");
    setCenterView("chat");
    if (payload.mode) setActiveMode(payload.mode);
    const targetId = auditFilterCurrentConversation ? payload.activeConversationId : undefined;
    await loadAuditRecords(targetId);
  };

  const handleRenameConversation = async (conversation: Conversation): Promise<void> => {
    const nextTitle = window.prompt("重命名会话", conversation.title)?.trim();
    if (!nextTitle) return;
    const updated = await window.enso.renameConversation(conversation.id, nextTitle);
    setConversations(updated);
  };

  const handleDeleteConversation = async (conversationId: string): Promise<void> => {
    const shouldDelete = window.confirm("确认删除该会话吗？");
    if (!shouldDelete) return;
    const payload = await window.enso.deleteConversation(conversationId);
    setConversations(payload.conversations);
    setActiveConversationId(payload.activeConversationId);
    setMessages(payload.messages);
    setStateSnapshot(payload.state);
    setAuditSummary(payload.audit);
    setComposerText("");
    setLastRunInfo("");
    setSubmitError("");
    if (payload.mode) setActiveMode(payload.mode);
    const targetId = auditFilterCurrentConversation ? payload.activeConversationId : undefined;
    await loadAuditRecords(targetId);
  };

  const handleTogglePin = async (conversationId: string): Promise<void> => {
    const updated = await window.enso.togglePinConversation(conversationId);
    setConversations(updated);
  };

  const handleModeSelect = async (mode: ModeId): Promise<void> => {
    if (!activeConversationId) return;
    const newMode = activeMode === mode ? DEFAULT_MODE : mode;
    setActiveMode(newMode);
    await window.enso.setMode(activeConversationId, newMode);
    setConversations((prev) =>
      prev.map((item) => (item.id === activeConversationId ? { ...item, mode: newMode } : item))
    );
  };

  const handleImportKnowledge = async (): Promise<void> => {
    const result = await window.enso.importKnowledgeFiles();
    setKnowledgeSources(result.knowledgeSources);
    if (result.imported.length === 0 && result.skipped.length === 0) {
      setImportStatus("未导入任何文件。");
      return;
    }
    const importedCount = result.imported.length;
    const skippedCount = result.skipped.length;
    setImportStatus(`已导入 ${importedCount} 个文件${skippedCount > 0 ? `，跳过 ${skippedCount} 个` : ""}.`);
  };

  const handleSend = async (): Promise<void> => {
    const text = composerText.trim();
    if (!text || !activeConversationId || isSubmitting) return;
    setSubmitError("");
    setIsSubmitting(true);
    // 乐观更新：立即显示用户消息并清空输入框，不等模型回复
    const optimisticUserMessage: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      conversationId: activeConversationId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);
    setComposerText("");
    setStateSnapshot((prev) => ({ ...prev, conversationId: activeConversationId, taskStatus: "processing" }));
    try {
      const result = await window.enso.submitRequest({
        conversationId: activeConversationId,
        mode: activeMode,
        text,
        enableRetrievalForTurn
      });
      // 用服务端返回的真实消息列表替换乐观更新
      setMessages(result.messages);
      setConversations(result.conversations);
      setStateSnapshot(result.state);
      setAuditSummary(result.audit);
      setLastRunInfo(
        `分类：${handlingClassLabel(result.classification.handlingClass)} | 检索：${boolLabel(
          result.classification.retrievalNeeded
        )} | 工具：${boolLabel(result.classification.toolNeeded)}`
      );
      setEnableRetrievalForTurn(false);
      const targetId = auditFilterCurrentConversation ? activeConversationId : undefined;
      await loadAuditRecords(targetId);
    } catch (error) {
      const refreshed = await window.enso.selectConversation(activeConversationId);
      setMessages(refreshed.messages);
      setStateSnapshot(refreshed.state);
      setAuditSummary(refreshed.audit);
      setSubmitError(error instanceof Error ? error.message : "请求失败。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolvePendingConfirmation = async (): Promise<void> => {
    if (!activeConversationId || isSubmitting) return;
    const result = await window.enso.resolvePendingConfirmation(activeConversationId);
    setMessages(result.messages);
    setStateSnapshot(result.state);
    setAuditSummary(result.audit);
    setLastRunInfo(
      stateSnapshot.pendingAction?.kind === "workspace_write"
        ? "已执行工作区写入。"
        : stateSnapshot.pendingAction?.kind === "host_exec"
          ? "已执行工作区命令。"
          : "已处理待确认动作。"
    );
    const targetId = auditFilterCurrentConversation ? activeConversationId : undefined;
    await loadAuditRecords(targetId);
  };

  const handleRejectPendingConfirmation = async (): Promise<void> => {
    if (!activeConversationId || isSubmitting) return;
    const result = await window.enso.rejectPendingConfirmation(activeConversationId);
    setMessages(result.messages);
    setStateSnapshot(result.state);
    setAuditSummary(result.audit);
    setLastRunInfo("已拒绝并取消待确认操作。");
    const targetId = auditFilterCurrentConversation ? activeConversationId : undefined;
    await loadAuditRecords(targetId);
  };

  const handleSaveSettings = async (): Promise<void> => {
    if (!settingsDraft) return;
    try {
      const saved = await window.enso.saveConfig({
        ...settingsDraft,
        provider: { ...settingsDraft.provider, apiKey: providerApiKeyDraft }
      });
      setConfig(saved);
      setSettingsDraft(saved);
      if (providerApiKeyDraft.trim()) setHasStoredApiKey(true);
      setProviderApiKeyDraft("");
      setSettingsStatus("设置已保存。若填写了 API Key，已写入本机安全存储。");
    } catch (error) {
      setSettingsStatus(toErrorMessage(error, "设置保存失败。"));
    }
  };

  const handleClearProviderApiKey = async (): Promise<void> => {
    if (!settingsDraft) return;
    await window.enso.clearProviderApiKey(settingsDraft.provider.provider);
    setProviderApiKeyDraft("");
    setHasStoredApiKey(false);
    setSettingsStatus("已清除本机保存的 API Key。");
  };

  const handleReloadSettings = async (): Promise<void> => {
    try {
      const latest = await window.enso.getConfig();
      setConfig(latest);
      setSettingsDraft(latest);
      setProviderApiKeyDraft("");
      await refreshProviderApiKeyStatus(latest.provider.provider);
      setSettingsStatus("已从本地配置重新加载。");
    } catch (error) {
      setSettingsStatus(toErrorMessage(error, "重新加载配置失败。"));
    }
  };

  // -- 初始化错误视图 --

  if (initializationError) {
    return (
      <div className="flex h-full items-center justify-center p-6" data-testid="init-error-view">
        <Card className="w-full max-w-2xl shadow-[0_18px_60px_rgba(15,23,42,0.12)]" data-testid="init-error-card">
          <CardHeader>
            <CardTitle>配置错误</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm leading-6 text-muted-foreground" data-testid="init-error-message">
              {initializationError}
            </div>
            <div className="text-sm text-muted-foreground">
              修正本地 `config.toml` 后，点击下方按钮重新加载，或重启应用。
            </div>
            <Button
              data-testid="init-error-reload-button"
              onClick={() => {
                window.location.reload();
              }}
              type="button"
            >
              重新加载
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -- 主布局：三栏面板 --

  return (
    <div className="h-full overflow-x-auto p-4" data-testid="layout-root">
      <div className="grid h-full min-w-[960px] grid-cols-[200px_1fr_280px] gap-3">
        <LeftPanel
          activeMode={activeMode}
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          conversations={conversations}
          activeConversationId={activeConversationId}
          centerView={centerView}
          onModeSelect={(mode) => {
            void handleModeSelect(mode);
          }}
          onCreateConversation={() => {
            void handleCreateConversation();
          }}
          onSelectConversation={(id) => {
            void handleSelectConversation(id);
          }}
          onRenameConversation={(c) => {
            void handleRenameConversation(c);
          }}
          onDeleteConversation={(id) => {
            void handleDeleteConversation(id);
          }}
          onTogglePin={(id) => {
            void handleTogglePin(id);
          }}
          onToggleCenterView={toggleCenterView}
        />

        <CenterPanel
          centerView={centerView}
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          activeConversation={activeConversation}
          activeMode={activeMode}
          knowledgeSources={knowledgeSources}
          messages={messages}
          composerText={composerText}
          enableRetrievalForTurn={enableRetrievalForTurn}
          submitError={submitError}
          lastRunInfo={lastRunInfo}
          importStatus={importStatus}
          stateSnapshot={stateSnapshot}
          appVersion={appInfo.version}
          settingsDraft={settingsDraft}
          settingsStatus={settingsStatus}
          providerApiKeyDraft={providerApiKeyDraft}
          hasStoredApiKey={hasStoredApiKey}
          auditRecords={auditRecords}
          auditFilterCurrentConversation={auditFilterCurrentConversation}
          onSend={() => {
            void handleSend();
          }}
          onResolvePendingConfirmation={() => {
            void handleResolvePendingConfirmation();
          }}
          onRejectPendingConfirmation={() => {
            void handleRejectPendingConfirmation();
          }}
          onImportKnowledge={() => {
            void handleImportKnowledge();
          }}
          onComposerTextChange={setComposerText}
          onRetrievalToggle={setEnableRetrievalForTurn}
          onSettingsDraftChange={setSettingsDraft}
          onProviderApiKeyDraftChange={setProviderApiKeyDraft}
          onSaveSettings={() => {
            void handleSaveSettings();
          }}
          onReloadSettings={() => {
            void handleReloadSettings();
          }}
          onClearProviderApiKey={() => {
            void handleClearProviderApiKey();
          }}
          onRefreshProviderApiKeyStatus={(id) => {
            void refreshProviderApiKeyStatus(id);
          }}
          onAuditFilterChange={setAuditFilterCurrentConversation}
          onLoadAuditRecords={() => {
            const cid = auditFilterCurrentConversation ? activeConversationId : undefined;
            void loadAuditRecords(cid);
          }}
        />

        <RightPanel
          activeMode={activeMode}
          activeModeDescription={activeModeDescription}
          config={config}
          knowledgeSources={knowledgeSources}
          workspaceRoot={workspaceRoot}
          stateSnapshot={stateSnapshot}
          auditSummary={auditSummary}
          latestRetrievedSnippets={latestRetrievedSnippets}
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          onResolvePendingConfirmation={() => {
            void handleResolvePendingConfirmation();
          }}
        />
      </div>
    </div>
  );
};

export default App;
