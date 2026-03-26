// Enso v2 中央面板
// 对话消息流 + 流式显示 + 输入框 + 模型选择
// 设置页面也在这里渲染

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ProviderId, PROVIDER_PRESETS, PROVIDER_MAP } from "@shared/providers";
import { ChatMessage, Conversation, EnsoConfig } from "@shared/types";
import { Button } from "@renderer/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Input } from "@renderer/components/ui/input";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Textarea } from "@renderer/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import alexAvatarUrl from "@renderer/assets/alex-avatar.jpg";
import ensoAvatarUrl from "@renderer/assets/enso-avatar.png";

export interface CenterPanelProps {
  isLoading: boolean;
  isStreaming: boolean;
  activeConversation: Conversation | null;
  messages: ChatMessage[];
  streamingText: string;
  composerText: string;
  submitError: string;
  showSettings: boolean;
  config: EnsoConfig | null;
  selectedProvider: ProviderId;
  selectedModel: string;
  configuredProviders: ProviderId[];
  onComposerTextChange: (text: string) => void;
  onSend: () => void;
  onCancelStream: () => void;
  onProviderChange: (provider: ProviderId) => void;
  onModelChange: (model: string) => void;
  onConfigChange: (config: EnsoConfig) => void;
  onConfiguredProvidersChange: (providers: ProviderId[]) => void;
  onRenameConversation: (conv: Conversation) => void;
}

// Markdown 渲染组件（用户/助手消息共用）
const MessageContent = ({ content, isUser }: { content: string; isUser: boolean }): JSX.Element => (
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
        <blockquote
          className={`my-2 border-l-2 pl-3 ${isUser ? "border-white/40 text-white/80" : "border-primary/20 text-muted-foreground"}`}
        >
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
          <code className={`rounded-md px-1.5 py-0.5 text-xs font-mono ${isUser ? "bg-white/15" : "bg-black/[0.04]"}`}>
            {children}
          </code>
        ),
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>
    }}
  >
    {content}
  </ReactMarkdown>
);

const CenterPanel = (props: CenterPanelProps): JSX.Element => {
  const {
    isLoading,
    isStreaming,
    activeConversation,
    messages,
    streamingText,
    composerText,
    submitError,
    showSettings,
    config,
    selectedProvider,
    selectedModel,
    configuredProviders,
    onComposerTextChange,
    onSend,
    onCancelStream,
    onProviderChange,
    onModelChange,
    onConfigChange,
    onConfiguredProvidersChange,
    onRenameConversation
  } = props;

  // 自动滚动到底部
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // 标题编辑状态
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // 标题编辑聚焦
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = (): void => {
    if (!activeConversation) return;
    setTitleDraft(activeConversation.title);
    setIsEditingTitle(true);
  };

  const commitTitleEdit = (): void => {
    const trimmed = titleDraft.trim();
    if (trimmed && activeConversation && trimmed !== activeConversation.title) {
      onRenameConversation({ ...activeConversation, title: trimmed });
    }
    setIsEditingTitle(false);
  };

  // ---- 设置页面状态 ----
  const [settingsStatus, setSettingsStatus] = useState("");
  const [hasKeyStatus, setHasKeyStatus] = useState<Record<string, boolean>>({});
  // API Key 输入草稿（按厂商）
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<string, string>>({});

  // 加载 API key 状态
  useEffect(() => {
    if (!showSettings) return;
    const loadKeyStatus = async (): Promise<void> => {
      const status: Record<string, boolean> = {};
      for (const preset of PROVIDER_PRESETS) {
        status[preset.id] = await window.enso.hasProviderApiKey(preset.id);
      }
      setHasKeyStatus(status);
    };
    loadKeyStatus().catch(() => {});
  }, [showSettings]);


  // 刷新状态
  const refreshAll = async (): Promise<void> => {
    const status: Record<string, boolean> = {};
    for (const preset of PROVIDER_PRESETS) {
      status[preset.id] = await window.enso.hasProviderApiKey(preset.id);
    }
    setHasKeyStatus(status);
    const configured = await window.enso.getConfiguredProviders();
    onConfiguredProvidersChange(configured);
  };

  // 保存某个厂商的 API Key
  const handleSaveKey = async (pid: ProviderId): Promise<void> => {
    if (!config) return;
    const key = apiKeyDrafts[pid]?.trim();
    if (!key) return;
    try {
      const updated = { ...config, providers: { ...config.providers } };
      updated.providers[pid] = { ...updated.providers[pid], apiKey: key };
      const saved = await window.enso.saveConfig(updated);
      onConfigChange(saved);
      setApiKeyDrafts((prev) => ({ ...prev, [pid]: "" }));
      setSettingsStatus(`${PROVIDER_MAP[pid].label} API Key 已保存。`);
      await refreshAll();
    } catch (error) {
      setSettingsStatus(error instanceof Error ? error.message : "保存失败。");
    }
  };

  // 清除某个厂商的 API Key
  const handleClearKey = async (pid: ProviderId): Promise<void> => {
    await window.enso.clearProviderApiKey(pid);
    setSettingsStatus(`已清除 ${PROVIDER_MAP[pid].label} 的 API Key。`);
    await refreshAll();
  };

  // 聊天中可选的厂商（有 API Key 的）
  const availableProviders = PROVIDER_PRESETS.filter((p) => configuredProviders.includes(p.id));
  // 当前选中厂商的可用模型（该厂商预设中的所有模型）
  const availableModels = PROVIDER_MAP[selectedProvider]?.models ?? [];

  // ---- 设置页面 ----
  if (showSettings && config) {
    return (
      <main className="flex h-full min-h-0 flex-col gap-2.5" data-testid="center-pane">
        <Card className="min-h-0 flex-1 flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0">
            <CardTitle>设置</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="space-y-6 text-sm">

                {/* ===== 第一区：API Key 管理（按厂商） ===== */}
                <div className="space-y-3">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                    API Key
                  </div>
                  {PROVIDER_PRESETS.map((preset) => (
                    <div key={preset.id} className="rounded-xl bg-black/[0.02] px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[13px] font-medium">{preset.label}</div>
                        {hasKeyStatus[preset.id] ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              已配置
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[11px] text-red-400 hover:text-red-500 h-7 px-2"
                              onClick={() => void handleClearKey(preset.id)}
                            >
                              清除
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50">未配置</span>
                        )}
                      </div>
                      {/* 未配置时显示输入框 */}
                      {!hasKeyStatus[preset.id] && (
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            className="flex-1 h-8 text-[12px]"
                            value={apiKeyDrafts[preset.id] ?? ""}
                            placeholder="输入 API Key"
                            onChange={(e) =>
                              setApiKeyDrafts((prev) => ({ ...prev, [preset.id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            className="h-8 px-3 text-[12px]"
                            onClick={() => void handleSaveKey(preset.id)}
                            disabled={!(apiKeyDrafts[preset.id] ?? "").trim()}
                          >
                            保存
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {settingsStatus && (
                  <div className="text-[12px] text-primary">{settingsStatus}</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    );
  }

  // 空状态：没有选中任何会话
  if (!activeConversation) {
    return (
      <main className="flex h-full min-h-0 flex-col items-center justify-center" data-testid="center-pane">
        <div className="text-center text-muted-foreground/40">
          <div className="text-[40px] mb-3">💭</div>
          <div className="text-[15px] font-medium mb-1">暂无会话</div>
          <div className="text-[13px]">点击左侧「新建」开始对话</div>
        </div>
      </main>
    );
  }

  // 对话页面
  return (
    <main className="flex h-full min-h-0 flex-col gap-2.5" data-testid="center-pane">
      {/* 头部：会话标题（点击可编辑） */}
      <Card className="shrink-0">
        <div className="flex items-center justify-between px-4 py-2.5">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              className="text-[15px] font-semibold text-foreground bg-transparent border-b border-primary/40 outline-none py-0 px-0 w-full mr-4"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitleEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitleEdit();
                if (e.key === "Escape") setIsEditingTitle(false);
              }}
            />
          ) : (
            <button
              className="text-[15px] font-semibold text-foreground hover:text-primary/80 transition-colors text-left truncate"
              onClick={handleTitleClick}
              type="button"
              title="点击重命名会话"
            >
              {activeConversation?.title ?? "Enso"}
            </button>
          )}
          <div className="text-[11px] text-muted-foreground shrink-0">v0.2.0</div>
        </div>
      </Card>

      {/* 消息列表 */}
      <Card className="min-h-0 flex-1 overflow-hidden">
        <CardContent className="h-full p-0">
          <div ref={scrollRef} className="h-full overflow-y-auto px-5 py-4">
            <div className="space-y-2.5" data-testid="chat-message-list">
              {messages.length === 0 && !isStreaming ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/40">
                  <div className="text-[32px] mb-2">💬</div>
                  <div className="text-[13px]">在下方输入以开始对话</div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === "user";
                  const isSystem = msg.role === "system";
                  if (msg.role === "tool") return null; // 不显示工具消息

                  return (
                    <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2.5`}>
                      {!isUser && !isSystem && (
                        <div className="shrink-0 mt-1">
                          <img src={ensoAvatarUrl} alt="Enso" className="w-7 h-7 rounded-full object-cover" />
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                          isUser
                            ? "bg-primary text-white max-w-[85%] rounded-br-md"
                            : "bg-white shadow-[0_0.5px_2px_rgba(0,0,0,0.06)] max-w-[85%] rounded-bl-md"
                        }`}
                      >
                        <MessageContent content={msg.content} isUser={isUser} />
                      </div>
                      {isUser && (
                        <div className="shrink-0 mt-1">
                          <img src={alexAvatarUrl} alt="Alex" className="w-7 h-7 rounded-full object-cover" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* 流式响应中的文本 */}
              {isStreaming && streamingText && (
                <div className="flex justify-start gap-2.5">
                  <div className="shrink-0 mt-1">
                    <img src={ensoAvatarUrl} alt="Enso" className="w-7 h-7 rounded-full object-cover" />
                  </div>
                  <div className="rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed bg-white shadow-[0_0.5px_2px_rgba(0,0,0,0.06)] max-w-[85%] rounded-bl-md">
                    <MessageContent content={streamingText} isUser={false} />
                    <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5" />
                  </div>
                </div>
              )}

              {/* 流式加载指示器（还没收到文字时） */}
              {isStreaming && !streamingText && (
                <div className="flex justify-start gap-2.5">
                  <div className="shrink-0 mt-1">
                    <img src={ensoAvatarUrl} alt="Enso" className="w-7 h-7 rounded-full object-cover" />
                  </div>
                  <div className="rounded-2xl px-4 py-2.5 text-[13px] bg-white shadow-[0_0.5px_2px_rgba(0,0,0,0.06)] rounded-bl-md">
                    <span className="text-muted-foreground/50">思考中...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 输入区 */}
      <Card className="shrink-0">
        <CardContent className="p-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Textarea
                data-testid="composer-input"
                placeholder="请输入你的消息...  Ctrl+Enter 发送"
                className="min-h-[72px] max-h-[160px]"
                value={composerText}
                onChange={(e) => onComposerTextChange(e.target.value)}
                onKeyDown={(e) => {
                  // Ctrl+Enter 或 Cmd+Enter 发送；Enter 正常换行
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              {isStreaming ? (
                <Button
                  onClick={onCancelStream}
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 rounded-full"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </Button>
              ) : (
                <Button
                  data-testid="composer-send-button"
                  onClick={onSend}
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  disabled={isLoading || !composerText.trim()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </Button>
              )}
            </div>
          </div>
          {/* 模型选择 + 状态（只显示已配置 API Key 的厂商） */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {availableProviders.length > 0 ? (
                <>
                  <select
                    className="h-7 rounded-lg bg-black/[0.04] px-2 text-[11px] text-foreground focus:outline-none"
                    value={selectedProvider}
                    onChange={(e) => {
                      const pid = e.target.value as ProviderId;
                      onProviderChange(pid);
                      const preset = PROVIDER_MAP[pid];
                      if (preset) onModelChange(preset.defaultModel);
                    }}
                  >
                    {availableProviders.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                  <select
                    className="h-7 rounded-lg bg-black/[0.04] px-2 text-[11px] text-foreground focus:outline-none"
                    value={selectedModel}
                    onChange={(e) => onModelChange(e.target.value)}
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground/50">
                  请先在设置中配置 API Key
                </span>
              )}
            </div>
            {submitError && (
              <div className="text-[10px] text-red-500">{submitError}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default CenterPanel;
