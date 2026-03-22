import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ModeId, OPTIONAL_MODES } from "@shared/modes";
import { PROVIDER_PRESETS, PROVIDER_PRESET_MAP, ProviderId } from "@shared/providers";
import {
  ACTION_TYPES,
  ACTION_TYPE_LABELS,
  ActionType,
  AuditSummary,
  ChatMessage,
  Conversation,
  EnsoConfig,
  KnowledgeSource,
  PERMISSION_LEVEL_LABELS,
  PermissionLevel,
  StateSnapshot
} from "@shared/types";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Input } from "@renderer/components/ui/input";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Separator } from "@renderer/components/ui/separator";
import { Textarea } from "@renderer/components/ui/textarea";
import { boolLabel, modeLabel, resultTypeLabel, roleLabel } from "@renderer/lib/labels";
import { CenterView } from "./LeftPanel";

export interface CenterPanelProps {
  centerView: CenterView;
  isLoading: boolean;
  isSubmitting: boolean;
  activeConversation: Conversation | null;
  activeMode: ModeId;
  knowledgeSources: KnowledgeSource[];
  messages: ChatMessage[];
  composerText: string;
  enableRetrievalForTurn: boolean;
  submitError: string;
  lastRunInfo: string;
  importStatus: string;
  stateSnapshot: StateSnapshot;
  appVersion: string;
  settingsDraft: EnsoConfig | null;
  settingsStatus: string;
  providerApiKeyDraft: string;
  hasStoredApiKey: boolean;
  auditRecords: AuditSummary[];
  auditFilterCurrentConversation: boolean;
  onSend: () => void;
  onResolvePendingConfirmation: () => void;
  onRejectPendingConfirmation: () => void;
  onImportKnowledge: () => void;
  onComposerTextChange: (text: string) => void;
  onRetrievalToggle: (enabled: boolean) => void;
  onSettingsDraftChange: (draft: EnsoConfig) => void;
  onProviderApiKeyDraftChange: (key: string) => void;
  onSaveSettings: () => void;
  onReloadSettings: () => void;
  onClearProviderApiKey: () => void;
  onRefreshProviderApiKeyStatus: (providerId: ProviderId) => void;
  onAuditFilterChange: (currentOnly: boolean) => void;
  onLoadAuditRecords: () => void;
}

const CenterPanel = (props: CenterPanelProps): JSX.Element => {
  const {
    centerView,
    isLoading,
    isSubmitting,
    activeConversation,
    activeMode,
    knowledgeSources,
    messages,
    composerText,
    enableRetrievalForTurn,
    submitError,
    lastRunInfo,
    importStatus,
    stateSnapshot,
    appVersion,
    settingsDraft,
    settingsStatus,
    providerApiKeyDraft,
    hasStoredApiKey,
    auditRecords,
    auditFilterCurrentConversation,
    onSend,
    onResolvePendingConfirmation,
    onRejectPendingConfirmation,
    onImportKnowledge,
    onComposerTextChange,
    onRetrievalToggle,
    onSettingsDraftChange,
    onProviderApiKeyDraftChange,
    onSaveSettings,
    onReloadSettings,
    onClearProviderApiKey,
    onRefreshProviderApiKeyStatus,
    onAuditFilterChange,
    onLoadAuditRecords
  } = props;

  return (
    <main className="flex h-full min-h-0 flex-col gap-2.5" data-testid="center-pane">
      <Card className="shrink-0">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div>
            <div className="text-[15px] font-semibold text-foreground" data-testid="chat-header-mode">
              {activeConversation?.title ?? "Enso"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {activeMode !== "default" ? `${modeLabel(activeMode)} \u00b7 ` : ""}
              {knowledgeSources.length > 0 ? "\u77e5\u8bc6\u5df2\u9644\u52a0" : "\u65e0\u9644\u52a0\u77e5\u8bc6"}
            </div>
          </div>
          <Badge variant="muted">{`v${appVersion}`}</Badge>
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
                      <div className="text-[32px] mb-2">{"\ud83d\udcac"}</div>
                      <div className="text-[13px]">
                        {"\u5728\u4e0b\u65b9\u8f93\u5165\u8bf7\u6c42\u4ee5\u5f00\u59cb\u5bf9\u8bdd"}
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const metadata = (message.metadata ?? {}) as Record<string, unknown>;
                      const retrievalUsed = metadata.retrievalUsed === true;
                      const toolName = typeof metadata.toolName === "string" ? metadata.toolName : "";
                      const toolSummary = typeof metadata.toolSummary === "string" ? metadata.toolSummary : "";
                      const retrievalSnippetCount =
                        typeof metadata.retrievalSnippetCount === "number" ? metadata.retrievalSnippetCount : 0;
                      const isUser = message.role === "user";
                      const isSystem = message.role === "system";

                      return (
                        <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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
                              <div
                                className={`mb-1 text-[10px] font-medium tracking-wide ${
                                  isSystem ? "text-orange-500" : "text-muted-foreground/50"
                                }`}
                              >
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
                                ol: ({ children }) => (
                                  <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>
                                ),
                                li: ({ children }) => <li className="text-[13px]">{children}</li>,
                                blockquote: ({ children }) => (
                                  <blockquote
                                    className={`my-2 border-l-2 pl-3 ${isUser ? "border-white/40 text-white/80" : "border-primary/20 text-muted-foreground"}`}
                                  >
                                    {children}
                                  </blockquote>
                                ),
                                pre: ({ children }) => (
                                  <pre
                                    className={`my-2 overflow-x-auto rounded-xl p-3 text-xs ${isUser ? "bg-white/10" : "bg-black/[0.03]"}`}
                                  >
                                    {children}
                                  </pre>
                                ),
                                code: ({ className, children }) =>
                                  className ? (
                                    <code className="text-xs font-mono">{children}</code>
                                  ) : (
                                    <code
                                      className={`rounded-md px-1.5 py-0.5 text-xs font-mono ${isUser ? "bg-white/15" : "bg-black/[0.04]"}`}
                                    >
                                      {children}
                                    </code>
                                  ),
                                strong: ({ children }) => <strong className="font-semibold">{children}</strong>
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                            {(retrievalUsed || toolName) && (
                              <div
                                className={`mt-1.5 text-[10px] ${isUser ? "text-white/50" : "text-muted-foreground/40"}`}
                              >
                                {retrievalUsed ? `\u5df2\u68c0\u7d22 ${retrievalSnippetCount} \u6761\u8bc1\u636e` : ""}
                                {toolName ? `${retrievalUsed ? " \u00b7 " : ""}\u5de5\u5177: ${toolName}` : ""}
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

          {stateSnapshot.pendingConfirmation && stateSnapshot.pendingAction && (
            <Card className="shrink-0" data-testid="center-confirmation-card">
              <CardContent className="p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-semibold text-foreground">{"待确认操作"}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {stateSnapshot.pendingAction.summary}
                    </div>
                  </div>
                  <Badge variant="outline">
                    {stateSnapshot.pendingAction.kind === "workspace_write" ? "工作区写入" : "工作区命令"}
                  </Badge>
                </div>

                {stateSnapshot.pendingAction.kind === "workspace_write" ? (
                  <div className="rounded-xl bg-black/[0.03] p-2.5 text-[11px] text-muted-foreground break-all">
                    {stateSnapshot.pendingAction.targetPath}
                  </div>
                ) : (
                  <div className="rounded-xl bg-black/[0.03] p-2.5 space-y-1 text-[11px] text-muted-foreground break-all">
                    <div>{stateSnapshot.pendingAction.workingDirectory}</div>
                    <div>{stateSnapshot.pendingAction.command}</div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    data-testid="center-confirm-button"
                    onClick={onResolvePendingConfirmation}
                    disabled={isLoading || isSubmitting}
                  >
                    {stateSnapshot.pendingAction.kind === "workspace_write"
                      ? "确认并执行工作区写入"
                      : "确认并执行工作区命令"}
                  </Button>
                  <Button
                    data-testid="center-reject-button"
                    variant="outline"
                    onClick={onRejectPendingConfirmation}
                    disabled={isLoading || isSubmitting}
                  >
                    {"拒绝并取消"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shrink-0">
            <CardContent className="p-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Textarea
                    data-testid="composer-input"
                    placeholder={"\u8bf7\u8f93\u5165\u4f60\u7684\u8bf7\u6c42..."}
                    className="min-h-[72px] max-h-[160px]"
                    value={composerText}
                    onChange={(event) => onComposerTextChange(event.target.value)}
                    disabled={isLoading || isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    data-testid="composer-send-button"
                    onClick={onSend}
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    disabled={isLoading || isSubmitting || !composerText.trim()}
                  >
                    {isSubmitting ? (
                      <span className="text-[10px]">{"\u00b7\u00b7\u00b7"}</span>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                  </Button>
                  <Button
                    data-testid="composer-import-button"
                    onClick={onImportKnowledge}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground"
                    disabled={isLoading || isSubmitting}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground select-none cursor-pointer">
                  <input
                    data-testid="composer-retrieval-toggle"
                    type="checkbox"
                    checked={enableRetrievalForTurn}
                    onChange={(event) => onRetrievalToggle(event.target.checked)}
                    disabled={isLoading || isSubmitting}
                  />
                  {"\u672c\u8f6e\u542f\u7528\u68c0\u7d22"}
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
            <CardTitle>{"\u77e5\u8bc6\u5e93"}</CardTitle>
            <Button
              data-testid="knowledge-import-button"
              onClick={onImportKnowledge}
              variant="outline"
              size="sm"
              disabled={isLoading || isSubmitting}
            >
              {"\u5bfc\u5165\u6587\u4ef6"}
            </Button>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="space-y-2" data-testid="knowledge-view">
                <div className="text-[11px] text-muted-foreground" data-testid="knowledge-count">
                  {"\u5df2\u5bfc\u5165"} {knowledgeSources.length} {"\u4e2a\u6765\u6e90"}
                </div>
                {importStatus && (
                  <div className="text-[11px] text-primary" data-testid="knowledge-import-status">
                    {importStatus}
                  </div>
                )}
                {knowledgeSources.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-[13px] text-muted-foreground/50">
                    {"\u6682\u65e0\u672c\u5730\u77e5\u8bc6\u6587\u4ef6"}
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
                        {source.chunkCount} {"\u4e2a\u5206\u5757"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {centerView === "settings" && settingsDraft && (
        <Card className="min-h-0 flex-1 flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0">
            <CardTitle>{"\u8bbe\u7f6e"}</CardTitle>
            <div className="flex gap-2">
              <Button
                data-testid="settings-reload-button"
                variant="outline"
                onClick={onReloadSettings}
                disabled={isLoading || isSubmitting}
              >
                {"\u91cd\u65b0\u52a0\u8f7d"}
              </Button>
              <Button data-testid="settings-save-button" onClick={onSaveSettings} disabled={isLoading || isSubmitting}>
                {"\u4fdd\u5b58"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {"\u6a21\u578b\u914d\u7f6e"}
                  </div>
                  <label className="space-y-1">
                    <div className="text-[12px] text-muted-foreground">{"\u5f53\u524d\u63d0\u4f9b\u5546"}</div>
                    <select
                      data-testid="settings-provider-select"
                      className="h-9 w-full rounded-[10px] bg-black/[0.04] px-3 text-[13px] text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={settingsDraft.provider.provider}
                      onChange={(event) => {
                        const nextProvider = event.target.value as ProviderId;
                        const preset = PROVIDER_PRESET_MAP[nextProvider];
                        onSettingsDraftChange({
                          ...settingsDraft,
                          provider: {
                            ...settingsDraft.provider,
                            provider: nextProvider,
                            model: preset?.defaultModel ?? settingsDraft.provider.model,
                            baseUrl: preset?.defaultBaseUrl ?? settingsDraft.provider.baseUrl
                          }
                        });
                        onProviderApiKeyDraftChange("");
                        onRefreshProviderApiKeyStatus(nextProvider);
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
                    {
                      "\u5207\u6362\u63d0\u4f9b\u5546\u65f6\u6a21\u578b\u548c URL \u4f1a\u81ea\u52a8\u586b\u5145\u4e3a\u8be5\u63d0\u4f9b\u5546\u7684\u9ed8\u8ba4\u503c\u3002"
                    }
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    API Key{" "}
                    {
                      "\u4e0d\u4f1a\u5199\u5165 TOML \u6216 SQLite \u660e\u6587\uff1b\u4fdd\u5b58\u65f6\u4f1a\u8fdb\u5165\u4e3b\u8fdb\u7a0b\u5b89\u5168\u5b58\u50a8\u3002"
                    }
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {"\u5f53\u524d\u662f\u5426\u5df2\u4fdd\u5b58 API Key\uff1a"}
                    {boolLabel(hasStoredApiKey)}
                  </div>
                  <label className="space-y-1">
                    <div className="text-[12px] text-muted-foreground">{"\u6a21\u578b"}</div>
                    <select
                      data-testid="settings-provider-model-input"
                      className="h-9 w-full rounded-[10px] bg-black/[0.04] px-3 text-[13px] text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={settingsDraft.provider.model}
                      onChange={(event) =>
                        onSettingsDraftChange({
                          ...settingsDraft,
                          provider: { ...settingsDraft.provider, model: event.target.value }
                        })
                      }
                    >
                      {(PROVIDER_PRESET_MAP[settingsDraft.provider.provider]?.models ?? []).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <div className="text-[12px] text-muted-foreground">{"\u57fa\u7840 URL"}</div>
                    <select
                      data-testid="settings-provider-baseurl-input"
                      className="h-9 w-full rounded-[10px] bg-black/[0.04] px-3 text-[13px] text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={settingsDraft.provider.baseUrl}
                      onChange={(event) =>
                        onSettingsDraftChange({
                          ...settingsDraft,
                          provider: { ...settingsDraft.provider, baseUrl: event.target.value }
                        })
                      }
                    >
                      {(PROVIDER_PRESET_MAP[settingsDraft.provider.provider]?.baseUrls ?? []).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <div className="text-[12px] text-muted-foreground">{"\u672c\u5730 API Key"}</div>
                    <Input
                      data-testid="settings-provider-apikey-input"
                      type="password"
                      value={providerApiKeyDraft}
                      onChange={(event) => onProviderApiKeyDraftChange(event.target.value)}
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      data-testid="settings-provider-clear-apikey-button"
                      type="button"
                      variant="outline"
                      onClick={onClearProviderApiKey}
                      disabled={isLoading || isSubmitting || !hasStoredApiKey}
                    >
                      {"\u6e05\u9664\u5df2\u5b58 API Key"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {"\u8868\u8fbe\u504f\u597d"}
                  </div>
                  <label className="space-y-1">
                    <div className="text-[12px] text-muted-foreground">{"\u56de\u590d\u5bc6\u5ea6"}</div>
                    <select
                      data-testid="settings-density-select"
                      className="h-9 w-full rounded-[10px] bg-black/[0.04] px-3 text-[13px] text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={settingsDraft.expression.density}
                      onChange={(event) =>
                        onSettingsDraftChange({
                          ...settingsDraft,
                          expression: {
                            ...settingsDraft.expression,
                            density: event.target.value as EnsoConfig["expression"]["density"]
                          }
                        })
                      }
                    >
                      <option value="concise">{"\u7cbe\u7b80"}</option>
                      <option value="standard">{"\u6807\u51c6"}</option>
                      <option value="detailed">{"\u8be6\u5c3d"}</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={settingsDraft.expression.structuredFirst}
                      onChange={(event) =>
                        onSettingsDraftChange({
                          ...settingsDraft,
                          expression: { ...settingsDraft.expression, structuredFirst: event.target.checked }
                        })
                      }
                    />
                    {"\u7ed3\u6784\u5316\u4f18\u5148"}
                  </label>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {"\u6c47\u62a5\u7c92\u5ea6"}
                  </div>
                  <label className="space-y-1">
                    <select
                      data-testid="settings-granularity-select"
                      className="h-9 w-full rounded-[10px] bg-black/[0.04] px-3 text-[13px] text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={settingsDraft.reportingGranularity}
                      onChange={(event) =>
                        onSettingsDraftChange({
                          ...settingsDraft,
                          reportingGranularity: event.target.value as EnsoConfig["reportingGranularity"]
                        })
                      }
                    >
                      <option value="plan-level">
                        {"\u65b9\u6848\u7ea7 \u2014 \u786e\u8ba4\u4e00\u6b21\uff0c\u4e0d\u518d\u6253\u65ad"}
                      </option>
                      <option value="result-level">
                        {"\u7ed3\u679c\u7ea7 \u2014 \u76f4\u63a5\u505a\u5b8c\u6c47\u62a5\u7ed3\u679c"}
                      </option>
                    </select>
                  </label>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {"\u6743\u9650"}
                  </div>
                  {ACTION_TYPES.map((actionType: ActionType) => (
                    <div key={actionType} className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-muted-foreground">{ACTION_TYPE_LABELS[actionType]}</span>
                      <select
                        className="h-7 rounded-lg bg-black/[0.04] px-2 text-[11px] text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={settingsDraft.permissions[actionType]}
                        onChange={(event) =>
                          onSettingsDraftChange({
                            ...settingsDraft,
                            permissions: {
                              ...settingsDraft.permissions,
                              [actionType]: event.target.value as PermissionLevel
                            }
                          })
                        }
                      >
                        {(["allow", "confirm", "block"] as const).map((level) => (
                          <option key={level} value={level}>
                            {PERMISSION_LEVEL_LABELS[level]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {"\u6a21\u5f0f\u9ed8\u8ba4\u503c"}
                  </div>
                  <div className="space-y-1">
                    <div className="text-[12px] text-muted-foreground">
                      {"\u6309\u6a21\u5f0f\u542f\u7528\u68c0\u7d22"}
                    </div>
                    {OPTIONAL_MODES.map((mode) => (
                      <label key={mode.id} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={settingsDraft.modeDefaults.retrievalByMode[mode.id]}
                          onChange={(event) =>
                            onSettingsDraftChange({
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
                  {settingsStatus ||
                    "\u4fee\u6539\u4f1a\u4fdd\u5b58\u5230 userData \u4e0b\u7684\u672c\u5730 config.toml\u3002"}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {centerView === "audits" && (
        <Card className="min-h-0 flex-1 flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0">
            <CardTitle>{"\u5ba1\u8ba1\u8bb0\u5f55"}</CardTitle>
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={auditFilterCurrentConversation}
                  onChange={(event) => onAuditFilterChange(event.target.checked)}
                />
                {"\u4ec5\u5f53\u524d\u4f1a\u8bdd"}
              </label>
              <Button variant="outline" onClick={onLoadAuditRecords} disabled={isLoading || isSubmitting}>
                {"\u5237\u65b0"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="space-y-2 text-sm" data-testid="audit-record-list">
                {auditRecords.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-[13px] text-muted-foreground/50">
                    {"\u6682\u65e0\u5ba1\u8ba1\u8bb0\u5f55\u3002"}
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
                        {"\u4f1a\u8bdd\uff1a"}
                        {record.conversationId}
                      </div>
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {"\u68c0\u7d22\uff1a"}
                        {boolLabel(record.retrievalUsed)} | {"\u5de5\u5177\uff1a"}
                        {record.toolsUsed.length > 0 ? record.toolsUsed.join(", ") : "\u65e0"}
                      </div>
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {"\u98ce\u9669\uff1a"}
                        {record.riskNotes || "--"}
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
  );
};

export default CenterPanel;
