import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MODES, ModeId } from "@shared/modes";
import {
  AuditSummary,
  ChatMessage,
  Conversation,
  EnsoConfig,
  RetrievedSnippet,
  StateSnapshot,
  KnowledgeSource
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
  taskStatus: "idle",
  updatedAt: new Date().toISOString()
});

const modeLabel = (mode: ModeId): string => MODES.find((item) => item.id === mode)?.label ?? mode;
const boolLabel = (value: boolean): string => (value ? "是" : "否");
const styleLabel = (style: EnsoConfig["expression"]["style"]): string =>
  style === "direct" ? "直给" : "平衡";
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

const App = (): JSX.Element => {
  const appInfo = window.enso.getAppInfo();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [config, setConfig] = useState<EnsoConfig | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [activeMode, setActiveMode] = useState<ModeId>("deep-dialogue");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stateSnapshot, setStateSnapshot] = useState<StateSnapshot>(defaultState(""));
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditSummary[]>([]);
  const [importStatus, setImportStatus] = useState<string>("");
  const [composerText, setComposerText] = useState<string>("");
  const [enableRetrievalForTurn, setEnableRetrievalForTurn] = useState<boolean>(false);
  const [lastRunInfo, setLastRunInfo] = useState<string>("");
  const [centerView, setCenterView] = useState<CenterView>("chat");
  const [settingsDraft, setSettingsDraft] = useState<EnsoConfig | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<string>("");
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
      if (!Array.isArray(raw)) {
        continue;
      }

      const snippets = raw.filter(isRetrievedSnippet);
      if (snippets.length > 0) {
        return snippets;
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

  const toggleCenterView = (next: CenterView): void => {
    setCenterView((prev) => (prev === next ? "chat" : next));
  };

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      const payload = await window.enso.initialize();

      setConfig(payload.config);
      setConversations(payload.conversations);
      setActiveConversationId(payload.activeConversationId);
      setMessages(payload.messages);
      setStateSnapshot(payload.state);
      setAuditSummary(payload.audit);
      setKnowledgeSources(payload.knowledgeSources);
      setSettingsDraft(payload.config);

      const activeConversationMode =
        payload.conversations.find((item) => item.id === payload.activeConversationId)?.mode ??
        payload.config.modeDefaults.defaultMode;
      setActiveMode(activeConversationMode);
      await loadAuditRecords(payload.activeConversationId);
      setIsLoading(false);
    };

    bootstrap().catch(() => {
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (config) {
      setSettingsDraft(config);
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
    setActiveMode("deep-dialogue");
    setComposerText("");
    setLastRunInfo("");
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

    setActiveMode(mode);
    await window.enso.setMode(activeConversationId, mode);
    setConversations((prev) =>
      prev.map((item) => (item.id === activeConversationId ? { ...item, mode } : item))
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
    setLastRunInfo("已确认待处理门控。未执行任何外部副作用。");

    const targetConversationId = auditFilterCurrentConversation ? activeConversationId : undefined;
    await loadAuditRecords(targetConversationId);
  };

  const handleSaveSettings = async (): Promise<void> => {
    if (!settingsDraft) {
      return;
    }

    const saved = await window.enso.saveConfig(settingsDraft);
    setConfig(saved);
    setSettingsDraft(saved);
    setSettingsStatus("设置已保存。");
  };

  const handleReloadSettings = async (): Promise<void> => {
    const latest = await window.enso.getConfig();
    setConfig(latest);
    setSettingsDraft(latest);
    setSettingsStatus("已从本地配置重新加载。");
  };

  return (
    <div className="h-full p-3" data-testid="layout-root">
      <div className="grid h-full grid-cols-[20%_55%_25%] gap-3">
        <aside className="flex h-full min-h-0 flex-col gap-3" data-testid="left-rail">
          <Card className="min-h-0 flex-1">
            <CardHeader>
              <CardTitle>模式</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {MODES.map((mode) => (
                <Button
                  key={mode.id}
                  data-testid={`mode-button-${mode.id}`}
                  className="w-full justify-start"
                  onClick={() => {
                    void handleModeSelect(mode.id);
                  }}
                  variant={activeMode === mode.id ? "default" : "outline"}
                  disabled={isLoading || isSubmitting}
                >
                  {mode.label}
                </Button>
              ))}
            </CardContent>

            <Separator className="my-1" />

            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase text-muted-foreground">会话</div>
                <Button
                  data-testid="conversation-create-button"
                  onClick={() => {
                    void handleCreateConversation();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  新建
                </Button>
              </div>
              <ScrollArea className="max-h-[280px]">
                <div className="space-y-2 pr-1">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      data-testid={`conversation-card-${conversation.id}`}
                      className={`rounded-md border p-2 text-sm transition ${
                        conversation.id === activeConversationId
                          ? "border-accent bg-accent/20"
                          : "border-border bg-muted/40 hover:bg-muted/60"
                      }`}
                    >
                      <button
                        className="w-full cursor-pointer text-left text-sm"
                        onClick={() => {
                          void handleSelectConversation(conversation.id);
                        }}
                        onDoubleClick={() => {
                          void handleRenameConversation(conversation);
                        }}
                        type="button"
                      >
                        {conversation.title}
                      </button>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void handleTogglePin(conversation.id);
                          }}
                          type="button"
                        >
                          {conversation.pinned ? "取消置顶" : "置顶"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void handleDeleteConversation(conversation.id);
                          }}
                          type="button"
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>

            <Separator className="my-1" />

            <CardContent className="space-y-2 pb-4">
              <div className="text-xs font-medium uppercase text-muted-foreground">全局</div>
              <Button
                data-testid="nav-knowledge-button"
                className="w-full justify-start"
                variant={centerView === "knowledge" ? "default" : "ghost"}
                onClick={() => toggleCenterView("knowledge")}
                disabled={isLoading || isSubmitting}
              >
                知识库
              </Button>
              <Button
                data-testid="nav-settings-button"
                className="w-full justify-start"
                variant={centerView === "settings" ? "default" : "ghost"}
                onClick={() => toggleCenterView("settings")}
                disabled={isLoading || isSubmitting}
              >
                设置
              </Button>
              <Button
                data-testid="nav-audits-button"
                className="w-full justify-start"
                variant={centerView === "audits" ? "default" : "ghost"}
                onClick={() => toggleCenterView("audits")}
                disabled={isLoading || isSubmitting}
              >
                审计记录
              </Button>
            </CardContent>
          </Card>
        </aside>

        <main className="flex h-full min-h-0 flex-col gap-3" data-testid="center-pane">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle>主聊天窗口</CardTitle>
                <div className="text-sm text-muted-foreground" data-testid="chat-header-mode">
                  模式：{modeLabel(activeMode)} | 会话：{activeConversation?.title ?? "--"}
                </div>
                <div className="text-xs text-muted-foreground">
                  已附加知识：{boolLabel(knowledgeSources.length > 0)} | 未完成状态：{" "}
                  {boolLabel(
                    stateSnapshot.taskStatus === "processing" || stateSnapshot.pendingConfirmation
                  )}
                </div>
              </div>
              <Badge variant="muted">{`${appInfo.name} ${appInfo.version}`}</Badge>
            </CardHeader>
          </Card>

          {centerView === "chat" && (
            <>
              <Card className="min-h-0 flex-1">
                <CardContent className="h-full p-0">
                  <ScrollArea className="h-full px-4 py-3">
                    <div className="space-y-3" data-testid="chat-message-list">
                      {messages.length === 0 ? (
                        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                          还没有消息。在下方输入请求以运行 MVP 执行链。
                        </div>
                      ) : (
                        messages.map((message) => {
                          const metadata = (message.metadata ?? {}) as Record<string, unknown>;
                          const retrievalUsed = metadata.retrievalUsed === true;
                          const toolName = typeof metadata.toolName === "string" ? metadata.toolName : "";

                          return (
                            <div
                              key={message.id}
                              className={`rounded-md border p-3 text-sm ${
                                message.role === "assistant"
                                  ? "border-accent/40 bg-accent/10"
                                  : "border-border bg-muted/40"
                              }`}
                            >
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {roleLabel(message.role)}
                              </div>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ children }) => <p className="mb-2 whitespace-pre-wrap">{children}</p>,
                                  h1: ({ children }) => <h1 className="mb-2 text-lg font-semibold">{children}</h1>,
                                  h2: ({ children }) => <h2 className="mb-2 text-base font-semibold">{children}</h2>,
                                  h3: ({ children }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>,
                                  blockquote: ({ children }) => (
                                    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
                                      {children}
                                    </blockquote>
                                  ),
                                  pre: ({ children }) => (
                                    <pre className="my-2 overflow-x-auto rounded-md bg-black/30 p-2 text-xs">
                                      {children}
                                    </pre>
                                  ),
                                  code: ({ inline, children }) =>
                                    inline ? (
                                      <code className="rounded bg-black/30 px-1 py-0.5 text-xs">{children}</code>
                                    ) : (
                                      <code className="text-xs">{children}</code>
                                    )
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                              {(retrievalUsed || toolName) && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  {retrievalUsed ? "已使用检索" : "未使用检索"}
                                  {toolName ? ` | 调用工具：${toolName}` : ""}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-2 p-3">
                  <Textarea
                    data-testid="composer-input"
                    placeholder="请输入你的请求..."
                    className="min-h-[120px]"
                    value={composerText}
                    onChange={(event) => setComposerText(event.target.value)}
                    disabled={isLoading || isSubmitting}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        data-testid="composer-retrieval-toggle"
                        type="checkbox"
                        checked={enableRetrievalForTurn}
                        onChange={(event) => setEnableRetrievalForTurn(event.target.checked)}
                        disabled={isLoading || isSubmitting}
                      />
                      本轮启用检索
                    </label>
                    <div className="flex gap-2">
                      <Button
                        data-testid="composer-import-button"
                        onClick={() => {
                          void handleImportKnowledge();
                        }}
                        variant="outline"
                        disabled={isLoading || isSubmitting}
                      >
                        导入文件
                      </Button>
                      <Button
                        data-testid="composer-send-button"
                        onClick={() => {
                          void handleSend();
                        }}
                        disabled={isLoading || isSubmitting || !composerText.trim()}
                      >
                        {isSubmitting ? "处理中..." : "发送"}
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="composer-status">
                    {lastRunInfo || importStatus || "当前为手动模式切换，未启用自动路由。"}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {centerView === "knowledge" && (
            <Card className="min-h-0 flex-1">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>知识库</CardTitle>
                <Button
                  data-testid="knowledge-import-button"
                  onClick={() => {
                    void handleImportKnowledge();
                  }}
                  variant="outline"
                  disabled={isLoading || isSubmitting}
                >
                  导入文件
                </Button>
              </CardHeader>
              <CardContent className="h-full min-h-0 p-0">
                <ScrollArea className="h-full px-4 pb-4">
                  <div className="space-y-2 text-sm" data-testid="knowledge-view">
                    <div className="text-xs text-muted-foreground" data-testid="knowledge-count">
                      已导入来源：{knowledgeSources.length}
                    </div>
                    {importStatus && (
                      <div className="text-xs text-muted-foreground" data-testid="knowledge-import-status">
                        {importStatus}
                      </div>
                    )}
                    {knowledgeSources.length === 0 ? (
                      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                        暂无本地知识文件。
                      </div>
                    ) : (
                      knowledgeSources.map((source) => (
                        <div
                          key={source.id}
                          data-testid={`knowledge-source-${source.id}`}
                          className="rounded-md border border-border bg-muted/30 p-3"
                        >
                          <div className="font-medium">{source.name}</div>
                          <div className="mt-1 break-all text-xs text-muted-foreground">{source.path}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            分块数：{source.chunkCount}
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
            <Card className="min-h-0 flex-1">
              <CardHeader className="flex-row items-center justify-between space-y-0">
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
              <CardContent className="h-full min-h-0 p-0">
                <ScrollArea className="h-full px-4 pb-4">
                  {!settingsDraft ? (
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                      设置不可用。
                    </div>
                  ) : (
                    <div className="space-y-4 text-sm">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="text-xs font-medium uppercase text-muted-foreground">模型配置</div>
                        <label className="space-y-1">
                          <div className="text-xs text-muted-foreground">模型</div>
                          <Input
                            value={settingsDraft.provider.model}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                provider: { ...settingsDraft.provider, model: event.target.value }
                              })
                            }
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="text-xs text-muted-foreground">基础 URL</div>
                          <Input
                            value={settingsDraft.provider.baseUrl}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                provider: { ...settingsDraft.provider, baseUrl: event.target.value }
                              })
                            }
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="text-xs text-muted-foreground">API Key 环境变量</div>
                          <Input
                            value={settingsDraft.provider.apiKeyEnv}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                provider: { ...settingsDraft.provider, apiKeyEnv: event.target.value }
                              })
                            }
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="text-xs text-muted-foreground">温度 (0-2)</div>
                          <Input
                            type="number"
                            min={0}
                            max={2}
                            step={0.1}
                            value={String(settingsDraft.provider.temperature)}
                            onChange={(event) => {
                              const nextTemperature = Number(event.target.value);
                              if (!Number.isFinite(nextTemperature)) {
                                return;
                              }
                              setSettingsDraft({
                                ...settingsDraft,
                                provider: { ...settingsDraft.provider, temperature: nextTemperature }
                              });
                            }}
                          />
                        </label>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase text-muted-foreground">表达偏好</div>
                        <label className="space-y-1">
                          <div className="text-xs text-muted-foreground">风格</div>
                          <select
                            data-testid="settings-style-select"
                            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                            value={settingsDraft.expression.style}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                expression: {
                                  ...settingsDraft.expression,
                                  style: event.target.value as EnsoConfig["expression"]["style"]
                                }
                              })
                            }
                          >
                            <option value="direct">直给</option>
                            <option value="balanced">平衡</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={settingsDraft.expression.reducedQuestioning}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                expression: {
                                  ...settingsDraft.expression,
                                  reducedQuestioning: event.target.checked
                                }
                              })
                            }
                          />
                          减少追问
                        </label>
                        <label className="space-y-1">
                          <div className="text-xs text-muted-foreground">默认假设</div>
                          <select
                            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                            value={settingsDraft.expression.defaultAssumption}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                expression: {
                                  ...settingsDraft.expression,
                                  defaultAssumption:
                                    event.target.value as EnsoConfig["expression"]["defaultAssumption"]
                                }
                              })
                            }
                          >
                            <option value="conservative">保守</option>
                            <option value="pragmatic">务实</option>
                          </select>
                        </label>
                        <label className="space-y-1">
                          <div className="text-xs text-muted-foreground">风险标注</div>
                          <select
                            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                            value={settingsDraft.expression.riskLabeling}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                expression: {
                                  ...settingsDraft.expression,
                                  riskLabeling:
                                    event.target.value as EnsoConfig["expression"]["riskLabeling"]
                                }
                              })
                            }
                          >
                            <option value="always">总是显示</option>
                            <option value="balanced-only">仅平衡风格显示</option>
                            <option value="off">关闭</option>
                          </select>
                        </label>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase text-muted-foreground">权限</div>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
                        <div className="text-xs font-medium uppercase text-muted-foreground">模式默认值</div>
                        <label className="space-y-1">
                          <div className="text-xs text-muted-foreground">默认模式</div>
                          <select
                            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                            value={settingsDraft.modeDefaults.defaultMode}
                            onChange={(event) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                modeDefaults: {
                                  ...settingsDraft.modeDefaults,
                                  defaultMode: event.target.value as ModeId
                                }
                              })
                            }
                          >
                            {MODES.map((mode) => (
                              <option key={mode.id} value={mode.id}>
                                {mode.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">按模式启用检索</div>
                          {MODES.map((mode) => (
                            <label key={mode.id} className="flex items-center gap-2 text-xs text-muted-foreground">
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

                      <div className="text-xs text-muted-foreground" data-testid="settings-status">
                        {settingsStatus || "修改会保存到 userData 下的本地 config.toml。"}
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {centerView === "audits" && (
            <Card className="min-h-0 flex-1">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>审计记录</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
              <CardContent className="h-full min-h-0 p-0">
                <ScrollArea className="h-full px-4 pb-4">
                  <div className="space-y-2 text-sm" data-testid="audit-record-list">
                    {auditRecords.length === 0 ? (
                      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                        暂无审计记录。
                      </div>
                    ) : (
                      auditRecords.map((record) => (
                        <div
                          key={record.id}
                          data-testid={`audit-record-${record.id}`}
                          className="rounded-md border border-border bg-muted/30 p-3"
                        >
                          <div className="font-medium">
                            {modeLabel(record.mode)} | {resultTypeLabel(record.resultType)}
                          </div>
                          <div className="mt-1 break-all text-xs text-muted-foreground">
                            会话：{record.conversationId}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            检索：{boolLabel(record.retrievalUsed)} | 工具：{" "}
                            {record.toolsUsed.length > 0 ? record.toolsUsed.join(", ") : "无"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            风险：{record.riskNotes || "--"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{record.createdAt}</div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </main>

        <aside className="flex h-full min-h-0 flex-col gap-3" data-testid="right-rail">
          <Card className="min-h-0 flex-1">
            <CardHeader>
              <CardTitle>当前上下文</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground" data-testid="context-panel">
              <div className="font-medium text-foreground">{modeLabel(activeMode)}</div>
              <div>{activeModeDescription}</div>
              <div>知识来源数：{knowledgeSources.length}</div>
              <div>表达风格：{config ? styleLabel(config.expression.style) : "--"}</div>
              {knowledgeSources.length > 0 && (
                <div className="rounded-md border border-border bg-muted/30 p-2 text-xs">
                  最新：{knowledgeSources[0].name}
                </div>
              )}
              <div className="pt-1 text-xs font-medium uppercase text-muted-foreground">
                已加载证据
              </div>
              {latestRetrievedSnippets.length === 0 ? (
                <div className="rounded-md border border-border bg-muted/30 p-2 text-xs">
                  最近一条助手回复未加载检索片段。
                </div>
              ) : (
                latestRetrievedSnippets.slice(0, 3).map((snippet, index) => (
                  <div key={`${snippet.sourcePath}:${index}`} className="rounded-md border border-border bg-muted/30 p-2 text-xs">
                    <div className="font-medium text-foreground">{snippet.sourceName}</div>
                    <div className="mt-1 break-all text-muted-foreground">{snippet.sourcePath}</div>
                    <div className="mt-1 max-h-24 overflow-hidden whitespace-pre-wrap">{snippet.content}</div>
                  </div>
                ))
              )}
              <div className="pt-1 text-xs font-medium uppercase text-muted-foreground">
                关键假设
              </div>
              <div className="space-y-1">
                {keyAssumptions.map((item, index) => (
                  <div key={index} className="text-xs">
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>

            <Separator className="my-1" />

            <CardHeader>
              <CardTitle>当前状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground" data-testid="state-panel">
              <div>是否使用检索：{boolLabel(stateSnapshot.retrievalUsed)}</div>
              <div>已调用工具：{stateSnapshot.toolsCalled.length ? stateSnapshot.toolsCalled.join(", ") : "无"}</div>
              <div>最近工具结果：{stateSnapshot.latestToolResult || "--"}</div>
              <div>待确认：{boolLabel(stateSnapshot.pendingConfirmation)}</div>
              <div>任务状态：{taskStatusLabel(stateSnapshot.taskStatus)}</div>
              {stateSnapshot.pendingConfirmation && (
                <Button
                  data-testid="resolve-confirmation-button"
                  size="sm"
                  onClick={() => {
                    void handleResolvePendingConfirmation();
                  }}
                  disabled={isLoading || isSubmitting}
                >
                  确认并清除门控
                </Button>
              )}
            </CardContent>

            <Separator className="my-1" />

            <CardHeader>
              <CardTitle>审计摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4 text-sm text-muted-foreground" data-testid="audit-summary-panel">
              <div>模式：{auditSummary ? modeLabel(auditSummary.mode) : "--"}</div>
              <div>检索：{auditSummary ? boolLabel(auditSummary.retrievalUsed) : "--"}</div>
              <div>工具：{auditSummary ? (auditSummary.toolsUsed.length ? auditSummary.toolsUsed.join(", ") : "无") : "--"}</div>
              <div>结果类型：{auditSummary ? resultTypeLabel(auditSummary.resultType) : "--"}</div>
              <div>风险说明：{auditSummary?.riskNotes || "--"}</div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default App;



