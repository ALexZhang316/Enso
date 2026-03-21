import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DEFAULT_MODE, MODES, OPTIONAL_MODES, ModeId } from "@shared/modes";
import { PROVIDER_PRESETS, PROVIDER_PRESET_MAP, ProviderId } from "@shared/providers";
import {
  AuditSummary,
  ChatMessage,
  Conversation,
  EnsoConfig,
  RetrievedSnippet,
  StateSnapshot,
  KnowledgeSource,
  TraceEntry,
  VerificationResult
} from "@shared/types";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Input } from "@renderer/components/ui/input";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Separator } from "@renderer/components/ui/separator";
import { Textarea } from "@renderer/components/ui/textarea";

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

const verificationStatusLabel = (status: VerificationResult["status"]): string => {
  switch (status) {
    case "passed": return "通过";
    case "skipped": return "跳过";
    case "blocked": return "被拦截";
    case "failed": return "失败";
    default: return status;
  }
};

const verificationStatusColor = (status: VerificationResult["status"]): string => {
  switch (status) {
    case "passed": return "text-green-600";
    case "skipped": return "text-yellow-600";
    case "blocked": return "text-orange-600";
    case "failed": return "text-red-600";
    default: return "text-muted-foreground";
  }
};

const tracePhaseLabel = (phase: TraceEntry["phase"]): string => {
  switch (phase) {
    case "classify": return "分类";
    case "plan": return "计划";
    case "retrieval": return "检索";
    case "tool": return "工具";
    case "model": return "模型";
    case "verification": return "验证";
    case "gate": return "门控";
    case "persist": return "持久化";
    default: return phase;
  }
};

const modeLabel = (mode: ModeId): string => MODES.find((item) => item.id === mode)?.label ?? mode;
const boolLabel = (value: boolean): string => (value ? "是" : "否");
const densityLabel = (d: EnsoConfig["expression"]["density"]): string =>
  d === "concise" ? "精简" : d === "detailed" ? "详尽" : "标准";
const granularityLabel = (g: EnsoConfig["reportingGranularity"]): string =>
  g === "result-level" ? "结果级" : "方案级";
const providerLabel = (providerId: ProviderId): string => PROVIDER_PRESET_MAP[providerId].label;
const taskStatusLabel = (status: StateSnapshot["taskStatus"]): string => {
  switch (status) {
    case "idle":
      return "空闲";
    case "processing":
      return "处理中";
    case "completed":
      return "已完成";
    case "awaiting_confirmation":
      return "等待确认";
    default:
      return status;
  }
};
const roleLabel = (role: ChatMessage["role"]): string => {
  switch (role) {
    case "user":
      return "用户";
    case "assistant":
      return "助手";
    case "system":
      return "系统";
    default:
      return role;
  }
};
const handlingClassLabel = (value: string): string => {
  switch (value) {
    case "pure-dialogue":
      return "纯对话";
    case "retrieval-enhanced":
      return "检索增强";
    case "tool-assisted":
      return "工具辅助";
    case "action-adjacent":
      return "动作邻近";
    default:
      return value;
  }
};
const resultTypeLabel = (value: AuditSummary["resultType"]): string => {
  switch (value) {
    case "answer":
      return "回答";
    case "proposal":
      return "提案";
    case "dry_run":
      return "演练";
    default:
      return value;
  }
};
type CenterView = "chat" | "knowledge" | "settings" | "audits";

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

const App = (): JSX.Element => {
  const appInfo = window.enso.getAppInfo();

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
      if (message.role !== "assistant" || !message.metadata) {
        continue;
      }

      const raw = (message.metadata as Record<string, unknown>).retrievedSnippets;
      if (Array.isArray(raw)) {
        return raw.filter(isRetrievedSnippet);
      }

      if ((message.metadata as Record<string, unknown>).retrievalUsed === true) {
        return [] as RetrievedSnippet[];
      }
    }

    return [] as RetrievedSnippet[];
  }, [messages]);

  const keyAssumptions = useMemo(() => {
    const assumptions: string[] = [];

    assumptions.push(`模式由用户手动固定：${modeLabel(activeMode)}.`);
    assumptions.push(stateSnapshot.retrievalUsed ? "本轮使用了本地检索证据。" : "本轮未使用检索证据。");
    assumptions.push(
      stateSnapshot.pendingConfirmation
        ? "只读门控生效，需先确认后继续。"
        : "当前没有待确认门控。"
    );

    return assumptions;
  }, [activeMode, stateSnapshot.pendingConfirmation, stateSnapshot.retrievalUsed]);

  const loadAuditRecords = async (
    conversationId?: string
  ): Promise<void> => {
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
    if (!activeConversationId) {
      return;
    }

    const conversationId = auditFilterCurrentConversation ? activeConversationId : undefined;
    loadAuditRecords(conversationId).catch(() => {
      setAuditRecords([]);
    });
  }, [activeConversationId, auditFilterCurrentConversation]);

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

    if (payload.mode) {
      setActiveMode(payload.mode);
    }

    const targetConversationId = auditFilterCurrentConversation
      ? payload.activeConversationId
      : undefined;
    await loadAuditRecords(targetConversationId);
  };

  const handleRenameConversation = async (conversation: Conversation): Promise<void> => {
    const nextTitle = window.prompt("重命名会话", conversation.title)?.trim();
    if (!nextTitle) {
      return;
    }

    const updated = await window.enso.renameConversation(conversation.id, nextTitle);
    setConversations(updated);
  };

  const handleDeleteConversation = async (conversationId: string): Promise<void> => {
    const shouldDelete = window.confirm("确认删除该会话吗？");
    if (!shouldDelete) {
      return;
    }

    const payload = await window.enso.deleteConversation(conversationId);
    setConversations(payload.conversations);
    setActiveConversationId(payload.activeConversationId);
    setMessages(payload.messages);
    setStateSnapshot(payload.state);
    setAuditSummary(payload.audit);
    setComposerText("");
    setLastRunInfo("");
    setSubmitError("");

    if (payload.mode) {
      setActiveMode(payload.mode);
    }

    const targetConversationId = auditFilterCurrentConversation
      ? payload.activeConversationId
      : undefined;
    await loadAuditRecords(targetConversationId);
  };

  const handleTogglePin = async (conversationId: string): Promise<void> => {
    const updated = await window.enso.togglePinConversation(conversationId);
    setConversations(updated);
  };

  const handleModeSelect = async (mode: ModeId): Promise<void> => {
    if (!activeConversationId) {
      return;
    }

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
    setImportStatus(
      `已导入 ${importedCount} 个文件${
        skippedCount > 0 ? `，跳过 ${skippedCount} 个` : ""
      }.`
    );
  };

  const handleSend = async (): Promise<void> => {
    const text = composerText.trim();
    if (!text || !activeConversationId || isSubmitting) {
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);
    setStateSnapshot((prev) => ({
      ...prev,
      conversationId: activeConversationId,
      taskStatus: "processing"
    }));

    try {
      const result = await window.enso.submitRequest({
        conversationId: activeConversationId,
        mode: activeMode,
        text,
        enableRetrievalForTurn
      });

      setMessages(result.messages);
      setConversations(result.conversations);
      setStateSnapshot(result.state);
      setAuditSummary(result.audit);
      setComposerText("");
      setLastRunInfo(
        `分类：${handlingClassLabel(result.classification.handlingClass)} | 检索：${boolLabel(
          result.classification.retrievalNeeded
        )} | 工具：${boolLabel(result.classification.toolNeeded)}`
      );
      setEnableRetrievalForTurn(false);
      const targetConversationId = auditFilterCurrentConversation
        ? activeConversationId
        : undefined;
      await loadAuditRecords(targetConversationId);
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
    if (!activeConversationId || isSubmitting) {
      return;
    }

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

    const targetConversationId = auditFilterCurrentConversation ? activeConversationId : undefined;
    await loadAuditRecords(targetConversationId);
  };

  const handleSaveSettings = async (): Promise<void> => {
    if (!settingsDraft) {
      return;
    }

    try {
      const saved = await window.enso.saveConfig({
        ...settingsDraft,
        provider: {
          ...settingsDraft.provider,
          apiKey: providerApiKeyDraft
        }
      });
      setConfig(saved);
      setSettingsDraft(saved);
      if (providerApiKeyDraft.trim()) {
        setHasStoredApiKey(true);
      }
      setProviderApiKeyDraft("");
      setSettingsStatus("设置已保存。若填写了 API Key，已写入本机安全存储。");
    } catch (error) {
      setSettingsStatus(toErrorMessage(error, "设置保存失败。"));
    }
  };

  const handleClearProviderApiKey = async (): Promise<void> => {
    if (!settingsDraft) {
      return;
    }

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

  return (
    <div className="h-full overflow-x-auto p-4" data-testid="layout-root">
      <div className="grid h-full min-w-[960px] grid-cols-[200px_1fr_280px] gap-3">
        <aside className="flex h-full min-h-0 flex-col gap-2.5" data-testid="left-rail">
          {/* Mode selector - toggle buttons (default mode is implicit) */}
          <Card className="shrink-0">
            <CardContent className="p-3">
              <div className="flex gap-1.5">
                {OPTIONAL_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    data-testid={`mode-button-${mode.id}`}
                    aria-pressed={activeMode === mode.id}
                    className={`flex-1 rounded-lg px-2 py-[7px] text-[11px] font-medium transition-all duration-200 whitespace-nowrap ${
                      activeMode === mode.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-black/[0.04] text-muted-foreground/70 hover:bg-black/[0.07] hover:text-foreground/60"
                    }`}
                    onClick={() => {
                      void handleModeSelect(mode.id);
                    }}
                    disabled={isLoading || isSubmitting}
                    type="button"
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Conversations list */}
          <Card className="min-h-0 flex-1 overflow-hidden">
            <CardContent className="flex h-full flex-col p-0">
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">会话</div>
                <button
                  data-testid="conversation-create-button"
                  className="text-[13px] font-medium text-primary hover:text-primary/80 transition-colors"
                  onClick={() => {
                    void handleCreateConversation();
                  }}
                  type="button"
                >
                  新建
                </button>
              </div>
              <ScrollArea className="flex-1 min-h-0 px-2 pb-2">
                <div className="space-y-0.5">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      data-testid={`conversation-card-${conversation.id}`}
                      className={`group rounded-xl px-3 py-2 text-[13px] transition-all duration-150 cursor-pointer ${
                        conversation.id === activeConversationId
                          ? "bg-primary text-white"
                          : "text-foreground hover:bg-black/[0.04]"
                      }`}
                      onClick={() => {
                        void handleSelectConversation(conversation.id);
                      }}
                      onDoubleClick={() => {
                        void handleRenameConversation(conversation);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`truncate ${conversation.pinned ? "font-medium" : ""}`}>
                          {conversation.pinned ? "📌 " : ""}{conversation.title}
                        </span>
                        <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                          conversation.id === activeConversationId ? "opacity-100" : ""
                        }`}>
                          <button
                            className={`rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${
                              conversation.id === activeConversationId
                                ? "hover:bg-white/20 text-white/80"
                                : "hover:bg-black/[0.06] text-muted-foreground"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleTogglePin(conversation.id);
                            }}
                            type="button"
                          >
                            {conversation.pinned ? "取固" : "置顶"}
                          </button>
                          <button
                            className={`rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${
                              conversation.id === activeConversationId
                                ? "hover:bg-white/20 text-white/80"
                                : "hover:bg-red-50 text-red-400"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteConversation(conversation.id);
                            }}
                            type="button"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Global nav */}
          <Card className="shrink-0">
            <CardContent className="p-2 space-y-0.5">
              {([
                { key: "knowledge" as CenterView, label: "知识库", testId: "nav-knowledge-button" },
                { key: "settings" as CenterView, label: "设置", testId: "nav-settings-button" },
                { key: "audits" as CenterView, label: "审计记录", testId: "nav-audits-button" }
              ]).map((nav) => (
                <button
                  key={nav.key}
                  data-testid={nav.testId}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] transition-all duration-150 ${
                    centerView === nav.key
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground/70 hover:bg-black/[0.04]"
                  }`}
                  onClick={() => toggleCenterView(nav.key)}
                  disabled={isLoading || isSubmitting}
                  type="button"
                >
                  {nav.label}
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>

        <main className="flex h-full min-h-0 flex-col gap-2.5" data-testid="center-pane">
          <Card className="shrink-0">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="text-[15px] font-semibold text-foreground" data-testid="chat-header-mode">
                  {activeConversation?.title ?? "Enso"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {activeMode !== "default" ? `${modeLabel(activeMode)} · ` : ""}{knowledgeSources.length > 0 ? "知识已附加" : "无附加知识"}
                </div>
              </div>
              <Badge variant="muted">{`v${appInfo.version}`}</Badge>
            </div>
          </Card>

          {centerView === "chat" && (
            <>
              <Card className="min-h-0 flex-1 overflow-hidden">
                <CardContent className="h-full p-0">
                  <ScrollArea className="h-full px-5 py-4">
                    <div className="space-y-2.5" data-testid="chat-message-list">
                      {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/40">
                          <div className="text-[32px] mb-2">💬</div>
                          <div className="text-[13px]">在下方输入请求以开始对话</div>
                        </div>
                      ) : (
                        messages.map((message) => {
                          const metadata = (message.metadata ?? {}) as Record<string, unknown>;
                          const retrievalUsed = metadata.retrievalUsed === true;
                          const toolName = typeof metadata.toolName === "string" ? metadata.toolName : "";
                          const toolSummary = typeof metadata.toolSummary === "string" ? metadata.toolSummary : "";
                          const retrievalSnippetCount = typeof metadata.retrievalSnippetCount === "number" ? metadata.retrievalSnippetCount : 0;
                          const isUser = message.role === "user";
                          const isSystem = message.role === "system";

                          return (
                            <div
                              key={message.id}
                              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                                  isUser
                                    ? "bg-primary text-white max-w-[85%] rounded-br-md"
                                    : isSystem
                                      ? "bg-orange-50 text-orange-800 max-w-[90%] border border-orange-100"
                                      : "bg-white shadow-[0_0.5px_2px_rgba(0,0,0,0.06)] max-w-[90%] rounded-bl-md"
                                }`}
                              >
                                {!isUser && (
                                  <div className={`mb-1 text-[10px] font-medium tracking-wide ${
                                    isSystem ? "text-orange-500" : "text-muted-foreground/50"
                                  }`}>
                                    {roleLabel(message.role)}
                                  </div>
                                )}
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
                                    h1: ({ children }) => <h1 className="mb-2 text-[15px] font-semibold">{children}</h1>,
                                    h2: ({ children }) => <h2 className="mb-2 text-[14px] font-semibold">{children}</h2>,
                                    h3: ({ children }) => <h3 className="mb-2 text-[13px] font-semibold">{children}</h3>,
                                    ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
                                    ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
                                    li: ({ children }) => <li className="text-[13px]">{children}</li>,
                                    blockquote: ({ children }) => (
                                      <blockquote className={`my-2 border-l-2 pl-3 ${isUser ? "border-white/40 text-white/80" : "border-primary/20 text-muted-foreground"}`}>
                                        {children}
                                      </blockquote>
                                    ),
                                    pre: ({ children }) => (
                                      <pre className={`my-2 overflow-x-auto rounded-xl p-3 text-xs ${isUser ? "bg-white/10" : "bg-black/[0.03]"}`}>
                                        {children}
                                      </pre>
                                    ),
                                    code: ({ className, children }) =>
                                      className ? (
                                        <code className="text-xs font-mono">{children}</code>
                                      ) : (
                                        <code className={`rounded-md px-1.5 py-0.5 text-xs font-mono ${isUser ? "bg-white/15" : "bg-black/[0.04]"}`}>{children}</code>
                                      ),
                                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                                {(retrievalUsed || toolName) && (
                                  <div className={`mt-1.5 text-[10px] ${isUser ? "text-white/50" : "text-muted-foreground/40"}`}>
                                    {retrievalUsed ? `已检索 ${retrievalSnippetCount} 条证据` : ""}
                                    {toolName ? `${retrievalUsed ? " · " : ""}工具: ${toolName}` : ""}
                                    {toolSummary ? ` (${toolSummary})` : ""}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Composer */}
              <Card className="shrink-0">
                <CardContent className="p-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Textarea
                        data-testid="composer-input"
                        placeholder="请输入你的请求..."
                        className="min-h-[72px] max-h-[160px]"
                        value={composerText}
                        onChange={(event) => setComposerText(event.target.value)}
                        disabled={isLoading || isSubmitting}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        data-testid="composer-send-button"
                        onClick={() => {
                          void handleSend();
                        }}
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        disabled={isLoading || isSubmitting || !composerText.trim()}
                      >
                        {isSubmitting ? (
                          <span className="text-[10px]">···</span>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        )}
                      </Button>
                      <Button
                        data-testid="composer-import-button"
                        onClick={() => {
                          void handleImportKnowledge();
                        }}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground"
                        disabled={isLoading || isSubmitting}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground select-none cursor-pointer">
                      <input
                        data-testid="composer-retrieval-toggle"
                        type="checkbox"
                        checked={enableRetrievalForTurn}
                        onChange={(event) => setEnableRetrievalForTurn(event.target.checked)}
                        disabled={isLoading || isSubmitting}
                      />
                      本轮启用检索
                    </label>
                    {(submitError || lastRunInfo || importStatus) && (
                      <div className="text-[10px] text-muted-foreground/60" data-testid="composer-status">
                        {submitError || lastRunInfo || importStatus}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {centerView === "knowledge" && (
            <Card className="min-h-0 flex-1 flex flex-col overflow-hidden">
              <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0">
                <CardTitle>知识库</CardTitle>
                <Button
                  data-testid="knowledge-import-button"
                  onClick={() => {
                    void handleImportKnowledge();
                  }}
                  variant="outline"
                  size="sm"
                  disabled={isLoading || isSubmitting}
                >
                  导入文件
                </Button>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-0">
                <ScrollArea className="h-full px-4 pb-4">
                  <div className="space-y-2" data-testid="knowledge-view">
                    <div className="text-[11px] text-muted-foreground" data-testid="knowledge-count">
                      已导入 {knowledgeSources.length} 个来源
                    </div>
                    {importStatus && (
                      <div className="text-[11px] text-primary" data-testid="knowledge-import-status">
                        {importStatus}
                      </div>
                    )}
                    {knowledgeSources.length === 0 ? (
                      <div className="flex items-center justify-center h-24 text-[13px] text-muted-foreground/50">
                        暂无本地知识文件
                      </div>
                    ) : (
                      knowledgeSources.map((source) => (
                        <div
                          key={source.id}
                          data-testid={`knowledge-source-${source.id}`}
                          className="rounded-xl bg-black/[0.03] p-3"
                        >
                          <div className="text-[13px] font-medium text-foreground">{source.name}</div>
                          <div className="mt-1 break-all text-[11px] text-muted-foreground">{source.path}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {source.chunkCount} 个分块
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {centerView === "settings" && (
            <Card className="min-h-0 flex-1 flex flex-col overflow-hidden">
              <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0">
                <CardTitle>设置</CardTitle>
                <div className="flex gap-2">
                  <Button
                    data-testid="settings-reload-button"
                    variant="outline"
                    onClick={() => {
                      void handleReloadSettings();
                    }}
                    disabled={isLoading || isSubmitting}
                  >
                    重新加载
                  </Button>
                  <Button
                    data-testid="settings-save-button"
                    onClick={() => {
                      void handleSaveSettings();
                    }}
                    disabled={isLoading || isSubmitting || !settingsDraft}
                  >
                    保存
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-0">
                <ScrollArea className="h-full px-4 pb-4">
                  {!settingsDraft ? (
                    <div className="flex items-center justify-center h-24 text-[13px] text-muted-foreground/50">
                      设置不可用。
                    </div>
                  ) : (
                    <div className="space-y-4 text-sm">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">模型配置</div>
                        <label className="space-y-1">
                          <div className="text-[12px] text-muted-foreground">当前提供商</div>
                          <select
                            data-testid="settings-provider-select"
                            className="h-9 w-full rounded-[10px] bg-black/[0.04] px-3 text-[13px] text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={settingsDraft.provider.provider}
                            onChange={(event) => {
                              const nextProvider = event.target.value as ProviderId;
                              const preset = PROVIDER_PRESET_MAP[nextProvider];
                              setSettingsDraft({
                                ...settingsDraft,
                                provider: {
                                  ...settingsDraft.provider,
                                  provider: nextProvider,
                                  model: preset?.defaultModel ?? settingsDraft.provider.model,
                                  baseUrl: preset?.defaultBaseUrl ?? settingsDraft.provider.baseUrl
                                }
                              });
                              setProviderApiKeyDraft("");
                              void refreshProviderApiKeyStatus(nextProvider);
                            }}
                          >
                            {PROVIDER_PRESETS.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.label} / {provider.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="rounded-xl bg-primary/[0.04] p-3 text-[11px] text-muted-foreground">
                          切换提供商时模型和 URL 会自动填充为该提供商的默认值。
                        </div>
                        <div className="text-[12px] text-muted-foreground">
                          API Key 不会写入 TOML 或 SQLite 明文；保存时会进入主进程安全存储。
                        </div>
                        <div className="text-[12px] text-muted-foreground">
                          当前是否已保存 API Key：{boolLabel(hasStoredApiKey)}
                        </div>
                        <label className="space-y-1">
                          <div className="text-[12px] text-muted-foreground">模型</div>
                          <select
                            data-testid="settings-provider-model-input"
                            className="h-9 w-full rounded-[10px] bg-black/[0.04] px-3 text-[13px] text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={settingsDraft.provider.model}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                provider: {
                                  ...settingsDraft.provider,
                                  model: event.target.value
                                }
                              })
                            }
                          >
                            {(PROVIDER_PRESET_MAP[settingsDraft.provider.provider]?.models ?? []).map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <div className="text-[12px] text-muted-foreground">基础 URL</div>
                          <select
                            data-testid="settings-provider-baseurl-input"
                            className="h-9 w-full rounded-[10px] bg-black/[0.04] px-3 text-[13px] text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={settingsDraft.provider.baseUrl}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                provider: {
                                  ...settingsDraft.provider,
                                  baseUrl: event.target.value
                                }
                              })
                            }
                          >
                            {(PROVIDER_PRESET_MAP[settingsDraft.provider.provider]?.baseUrls ?? []).map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <div className="text-[12px] text-muted-foreground">本地 API Key</div>
                          <Input
                            data-testid="settings-provider-apikey-input"
                            type="password"
                            value={providerApiKeyDraft}
                            onChange={(event) => setProviderApiKeyDraft(event.target.value)}
                          />
                        </label>
                        <div className="flex gap-2">
                          <Button
                            data-testid="settings-provider-clear-apikey-button"
                            type="button"
                            variant="outline"
                            onClick={() => {
                              void handleClearProviderApiKey();
                            }}
                            disabled={isLoading || isSubmitting || !hasStoredApiKey}
                          >
                            清除已存 API Key
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">表达偏好</div>
                        <label className="space-y-1">
                          <div className="text-[12px] text-muted-foreground">回复密度</div>
                          <select
                            data-testid="settings-density-select"
                            className="h-9 w-full rounded-[10px] bg-black/[0.04] px-3 text-[13px] text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={settingsDraft.expression.density}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                expression: {
                                  ...settingsDraft.expression,
                                  density: event.target.value as EnsoConfig["expression"]["density"]
                                }
                              })
                            }
                          >
                            <option value="concise">精简</option>
                            <option value="standard">标准</option>
                            <option value="detailed">详尽</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={settingsDraft.expression.structuredFirst}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                expression: {
                                  ...settingsDraft.expression,
                                  structuredFirst: event.target.checked
                                }
                              })
                            }
                          />
                          结构化优先
                        </label>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">汇报粒度</div>
                        <label className="space-y-1">
                          <select
                            data-testid="settings-granularity-select"
                            className="h-9 w-full rounded-[10px] bg-black/[0.04] px-3 text-[13px] text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={settingsDraft.reportingGranularity}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                reportingGranularity: event.target.value as EnsoConfig["reportingGranularity"]
                              })
                            }
                          >
                            <option value="plan-level">方案级 — 确认一次，不再打断</option>
                            <option value="result-level">结果级 — 直接做完汇报结果</option>
                          </select>
                        </label>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">权限</div>
                        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={settingsDraft.permissions.readOnlyDefault}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                permissions: {
                                  ...settingsDraft.permissions,
                                  readOnlyDefault: event.target.checked
                                }
                              })
                            }
                          />
                          默认只读
                        </label>
                        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={settingsDraft.permissions.requireConfirmationForWrites}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                permissions: {
                                  ...settingsDraft.permissions,
                                  requireConfirmationForWrites: event.target.checked
                                }
                              })
                            }
                          />
                          写入类动作前需确认
                        </label>
                        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={settingsDraft.permissions.requireDoubleConfirmationForExternal}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                permissions: {
                                  ...settingsDraft.permissions,
                                  requireDoubleConfirmationForExternal: event.target.checked
                                }
                              })
                            }
                          />
                          外部动作需双重确认
                        </label>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">模式默认值</div>
                        <div className="space-y-1">
                          <div className="text-[12px] text-muted-foreground">按模式启用检索</div>
                          {OPTIONAL_MODES.map((mode) => (
                            <label key={mode.id} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={settingsDraft.modeDefaults.retrievalByMode[mode.id]}
                                onChange={(event) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    modeDefaults: {
                                      ...settingsDraft.modeDefaults,
                                      retrievalByMode: {
                                        ...settingsDraft.modeDefaults.retrievalByMode,
                                        [mode.id]: event.target.checked
                                      }
                                    }
                                  })
                                }
                              />
                              {mode.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="text-[12px] text-muted-foreground" data-testid="settings-status">
                        {settingsStatus || "修改会保存到 userData 下的本地 config.toml。"}
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {centerView === "audits" && (
            <Card className="min-h-0 flex-1 flex flex-col overflow-hidden">
              <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0">
                <CardTitle>审计记录</CardTitle>
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={auditFilterCurrentConversation}
                      onChange={(event) => setAuditFilterCurrentConversation(event.target.checked)}
                    />
                    仅当前会话
                  </label>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const conversationId = auditFilterCurrentConversation
                        ? activeConversationId
                        : undefined;
                      void loadAuditRecords(conversationId);
                    }}
                    disabled={isLoading || isSubmitting}
                  >
                    刷新
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-0">
                <ScrollArea className="h-full px-4 pb-4">
                  <div className="space-y-2 text-sm" data-testid="audit-record-list">
                    {auditRecords.length === 0 ? (
                      <div className="flex items-center justify-center h-24 text-[13px] text-muted-foreground/50">
                        暂无审计记录。
                      </div>
                    ) : (
                      auditRecords.map((record) => (
                        <div
                          key={record.id}
                          data-testid={`audit-record-${record.id}`}
                          className="rounded-xl bg-black/[0.03] p-3"
                        >
                          <div className="font-medium">
                            {modeLabel(record.mode)} | {resultTypeLabel(record.resultType)}
                          </div>
                          <div className="mt-1 break-all text-[12px] text-muted-foreground">
                            会话：{record.conversationId}
                          </div>
                          <div className="mt-1 text-[12px] text-muted-foreground">
                            检索：{boolLabel(record.retrievalUsed)} | 工具：{" "}
                            {record.toolsUsed.length > 0 ? record.toolsUsed.join(", ") : "无"}
                          </div>
                          <div className="mt-1 text-[12px] text-muted-foreground">
                            风险：{record.riskNotes || "--"}
                          </div>
                          <div className="mt-1 text-[12px] text-muted-foreground">{record.createdAt}</div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </main>

        <aside className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden" data-testid="right-rail">
          {/* Context info */}
          <Card className="shrink-0" data-testid="context-panel">
            <CardContent className="p-3 space-y-3">
              <div>
                <div className="text-[15px] font-semibold text-foreground">{activeMode === "default" ? "Enso" : modeLabel(activeMode)}</div>
                {activeMode !== "default" && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{activeModeDescription}</div>
                )}
              </div>
              {/* iOS-style info rows */}
              <div className="rounded-xl bg-black/[0.03] divide-y divide-black/[0.04] overflow-hidden">
                {([
                  ["提供商", config ? providerLabel(config.provider.provider) : "--"],
                  ["模型", config?.provider.model ?? "--"],
                  ["知识", `${knowledgeSources.length} 个来源`],
                  ["工作区", workspaceRoot || "--"],
                  ["密度", config ? densityLabel(config.expression.density) : "--"],
                  ["汇报", config ? granularityLabel(config.reportingGranularity) : "--"]
                ] as const).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-3 py-2 gap-2">
                    <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
                    <span className="text-[11px] text-foreground/70 truncate text-right">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* State + Plan + Trace + Verification (scrollable) */}
          <Card className="min-h-0 flex-1 overflow-hidden">
            <CardContent className="h-full p-0">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-3">

                  {/* Plan section */}
                  <div data-testid="plan-panel">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                      计划
                    </div>
                    {stateSnapshot.plan ? (
                      <div className="rounded-xl bg-black/[0.03] p-2.5 space-y-1.5">
                        <div className="text-[11px] font-medium text-foreground">{stateSnapshot.plan.goal}</div>
                        <div className="space-y-0.5">
                          {stateSnapshot.plan.steps.map((step, i) => (
                            <div key={i} className="text-[10px] text-muted-foreground leading-relaxed">
                              {i + 1}. {step}
                            </div>
                          ))}
                        </div>
                        {stateSnapshot.plan.likelyTools.length > 0 && (
                          <div className="text-[10px] text-muted-foreground/60">
                            工具: {stateSnapshot.plan.likelyTools.join(", ")}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground/60">
                          验证目标: {stateSnapshot.plan.verificationTarget}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground/40">无计划 (纯对话)</div>
                    )}
                  </div>

                  {/* Execution trace section */}
                  <div data-testid="trace-panel">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                      执行轨迹
                    </div>
                    {stateSnapshot.trace.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground/40">无轨迹</div>
                    ) : (
                      <div className="rounded-xl bg-black/[0.03] divide-y divide-black/[0.04] overflow-hidden">
                        {stateSnapshot.trace.map((entry, i) => (
                          <div key={i} className="px-3 py-1.5">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">{tracePhaseLabel(entry.phase)}</Badge>
                              <span className="text-[9px] text-muted-foreground/40">{entry.timestamp.slice(11, 19)}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed break-all">{entry.summary}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Verification section */}
                  <div data-testid="verification-panel">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                      验证结果
                    </div>
                    {stateSnapshot.verification ? (
                      <div className="rounded-xl bg-black/[0.03] p-2.5">
                        <div className={`text-[12px] font-semibold ${verificationStatusColor(stateSnapshot.verification.status)}`}>
                          {verificationStatusLabel(stateSnapshot.verification.status)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{stateSnapshot.verification.detail}</div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground/40">无验证结果</div>
                    )}
                  </div>

                  {/* Evidence section */}
                  <div data-testid="evidence-panel">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                      证据
                    </div>
                    {latestRetrievedSnippets.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground/40">
                        无检索片段
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {latestRetrievedSnippets.slice(0, 3).map((snippet, index) => (
                          <div key={`${snippet.sourcePath}:${index}`} className="rounded-xl bg-black/[0.03] p-2.5">
                            <div className="text-[11px] font-medium text-foreground">{snippet.sourceName}</div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground/50 truncate">{snippet.sourcePath}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pending action */}
                  <div data-testid="pending-action-panel">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                      待确认动作
                    </div>
                    {stateSnapshot.pendingAction ? (
                      <div className="rounded-xl bg-black/[0.03] p-2.5 space-y-1">
                        <div className="text-[11px] font-medium text-foreground">
                          {stateSnapshot.pendingAction.summary}
                        </div>
                        {stateSnapshot.pendingAction.kind === "workspace_write" ? (
                          <div className="text-[10px] text-muted-foreground/70 break-all">
                            {stateSnapshot.pendingAction.targetPath}
                          </div>
                        ) : (
                          <>
                            <div className="text-[10px] text-muted-foreground/70 break-all">
                              {stateSnapshot.pendingAction.workingDirectory}
                            </div>
                            <div className="text-[10px] text-muted-foreground/70 break-all">
                              {stateSnapshot.pendingAction.command}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground/40">无待确认动作</div>
                    )}
                  </div>

                  {/* State */}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                      状态
                    </div>
                    <div className="rounded-xl bg-black/[0.03] divide-y divide-black/[0.04] overflow-hidden" data-testid="state-panel">
                      {([
                        ["检索", boolLabel(stateSnapshot.retrievalUsed)],
                        ["工具", stateSnapshot.toolsCalled.length ? stateSnapshot.toolsCalled.join(", ") : "无"],
                        ["待确认", boolLabel(stateSnapshot.pendingConfirmation)],
                        ["任务", taskStatusLabel(stateSnapshot.taskStatus)]
                      ] as const).map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between px-3 py-2">
                          <span className="text-[11px] text-muted-foreground">{label}</span>
                          <span className="text-[11px] text-foreground/70">{value}</span>
                        </div>
                      ))}
                    </div>
                    {stateSnapshot.pendingConfirmation && (
                      <Button
                        data-testid="resolve-confirmation-button"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => {
                          void handleResolvePendingConfirmation();
                        }}
                        disabled={isLoading || isSubmitting}
                      >
                        {stateSnapshot.pendingAction?.kind === "workspace_write"
                          ? "确认并执行工作区写入"
                          : stateSnapshot.pendingAction?.kind === "host_exec"
                            ? "确认并执行工作区命令"
                          : "确认并清除门控"}
                      </Button>
                    )}
                  </div>

                  {/* Audit summary */}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                      审计
                    </div>
                    <div className="rounded-xl bg-black/[0.03] divide-y divide-black/[0.04] overflow-hidden" data-testid="audit-summary-panel">
                      {([
                        ["模式", auditSummary ? modeLabel(auditSummary.mode) : "--"],
                        ["检索", auditSummary ? boolLabel(auditSummary.retrievalUsed) : "--"],
                        ["工具", auditSummary ? (auditSummary.toolsUsed.length ? auditSummary.toolsUsed.join(", ") : "无") : "--"],
                        ["类型", auditSummary ? resultTypeLabel(auditSummary.resultType) : "--"],
                        ["风险", auditSummary?.riskNotes || "--"]
                      ] as const).map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between px-3 py-2">
                          <span className="text-[11px] text-muted-foreground">{label}</span>
                          <span className="text-[11px] text-foreground/70">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default App;
