import { useEffect, useMemo, useState } from "react";
import { MODES, ModeId } from "@shared/modes";
import {
  AuditSummary,
  ChatMessage,
  Conversation,
  EnsoConfig,
  StateSnapshot,
  KnowledgeSource
} from "@shared/types";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
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
  const [importStatus, setImportStatus] = useState<string>("");
  const [composerText, setComposerText] = useState<string>("");
  const [enableRetrievalForTurn, setEnableRetrievalForTurn] = useState<boolean>(false);
  const [lastRunInfo, setLastRunInfo] = useState<string>("");

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );

  const activeModeDescription = useMemo(
    () => MODES.find((mode) => mode.id === activeMode)?.description ?? "",
    [activeMode]
  );

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

      const activeConversationMode =
        payload.conversations.find((item) => item.id === payload.activeConversationId)?.mode ??
        payload.config.modeDefaults.defaultMode;
      setActiveMode(activeConversationMode);
      setIsLoading(false);
    };

    bootstrap().catch(() => {
      setIsLoading(false);
    });
  }, []);

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
  };

  const handleRenameConversation = async (conversation: Conversation): Promise<void> => {
    const nextTitle = window.prompt("Rename conversation", conversation.title)?.trim();
    if (!nextTitle) {
      return;
    }

    const updated = await window.enso.renameConversation(conversation.id, nextTitle);
    setConversations(updated);
  };

  const handleDeleteConversation = async (conversationId: string): Promise<void> => {
    const shouldDelete = window.confirm("Delete this conversation?");
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
      setImportStatus("No files imported.");
      return;
    }

    const importedCount = result.imported.length;
    const skippedCount = result.skipped.length;
    setImportStatus(
      `Imported ${importedCount} file${importedCount === 1 ? "" : "s"}${
        skippedCount > 0 ? `, skipped ${skippedCount}` : ""
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
        `Class: ${result.classification.handlingClass} | Retrieval: ${
          result.classification.retrievalNeeded ? "yes" : "no"
        } | Tool: ${result.classification.toolNeeded ? "yes" : "no"}`
      );
      setEnableRetrievalForTurn(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full p-3">
      <div className="grid h-full grid-cols-[20%_55%_25%] gap-3">
        <aside className="flex h-full min-h-0 flex-col gap-3">
          <Card className="min-h-0 flex-1">
            <CardHeader>
              <CardTitle>Modes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {MODES.map((mode) => (
                <Button
                  key={mode.id}
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
                <div className="text-xs font-medium uppercase text-muted-foreground">Conversations</div>
                <Button
                  onClick={() => {
                    void handleCreateConversation();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  New
                </Button>
              </div>
              <ScrollArea className="max-h-[280px]">
                <div className="space-y-2 pr-1">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
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
                          {conversation.pinned ? "Unpin" : "Pin"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void handleDeleteConversation(conversation.id);
                          }}
                          type="button"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>

            <Separator className="my-1" />

            <CardContent className="space-y-2 pb-4">
              <div className="text-xs font-medium uppercase text-muted-foreground">Global</div>
              <Button className="w-full justify-start" variant="ghost">
                Knowledge Base
              </Button>
              <Button className="w-full justify-start" variant="ghost">
                Settings
              </Button>
              <Button className="w-full justify-start" variant="ghost">
                Audit Records
              </Button>
            </CardContent>
          </Card>
        </aside>

        <main className="flex h-full min-h-0 flex-col gap-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle>Main Chat Window</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Mode: {modeLabel(activeMode)} | Conversation: {activeConversation?.title ?? "--"}
                </div>
              </div>
              <Badge variant="muted">{`${appInfo.name} ${appInfo.version}`}</Badge>
            </CardHeader>
          </Card>

          <Card className="min-h-0 flex-1">
            <CardContent className="h-full p-0">
              <ScrollArea className="h-full px-4 py-3">
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                      No messages yet. Enter a request below to run the MVP execution flow.
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
                            {message.role}
                          </div>
                          <div className="whitespace-pre-wrap">{message.content}</div>
                          {(retrievalUsed || toolName) && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {retrievalUsed ? "retrieval used" : "no retrieval"}
                              {toolName ? ` | tool called: ${toolName}` : ""}
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
                placeholder="Write your request..."
                className="min-h-[120px]"
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                disabled={isLoading || isSubmitting}
              />
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={enableRetrievalForTurn}
                    onChange={(event) => setEnableRetrievalForTurn(event.target.checked)}
                    disabled={isLoading || isSubmitting}
                  />
                  Enable retrieval for this turn
                </label>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      void handleImportKnowledge();
                    }}
                    variant="outline"
                    disabled={isLoading || isSubmitting}
                  >
                    Import File
                  </Button>
                  <Button
                    onClick={() => {
                      void handleSend();
                    }}
                    disabled={isLoading || isSubmitting || !composerText.trim()}
                  >
                    {isSubmitting ? "Running..." : "Send"}
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {lastRunInfo || importStatus || "Manual mode switching is active. No auto-routing is enabled."}
              </div>
            </CardContent>
          </Card>
        </main>

        <aside className="flex h-full min-h-0 flex-col gap-3">
          <Card className="min-h-0 flex-1">
            <CardHeader>
              <CardTitle>Current Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">{modeLabel(activeMode)}</div>
              <div>{activeModeDescription}</div>
              <div>Knowledge sources: {knowledgeSources.length}</div>
              <div>Expression style: {config?.expression.style ?? "--"}</div>
              {knowledgeSources.length > 0 && (
                <div className="rounded-md border border-border bg-muted/30 p-2 text-xs">
                  Latest: {knowledgeSources[0].name}
                </div>
              )}
            </CardContent>

            <Separator className="my-1" />

            <CardHeader>
              <CardTitle>Current State</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>Retrieval used: {stateSnapshot.retrievalUsed ? "yes" : "no"}</div>
              <div>Tools called: {stateSnapshot.toolsCalled.length ? stateSnapshot.toolsCalled.join(", ") : "none"}</div>
              <div>Latest tool result: {stateSnapshot.latestToolResult || "--"}</div>
              <div>Pending confirmation: {stateSnapshot.pendingConfirmation ? "yes" : "no"}</div>
              <div>Task status: {stateSnapshot.taskStatus}</div>
            </CardContent>

            <Separator className="my-1" />

            <CardHeader>
              <CardTitle>Audit Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4 text-sm text-muted-foreground">
              <div>Mode: {auditSummary ? modeLabel(auditSummary.mode) : "--"}</div>
              <div>Retrieval: {auditSummary ? (auditSummary.retrievalUsed ? "yes" : "no") : "--"}</div>
              <div>Tools: {auditSummary ? (auditSummary.toolsUsed.length ? auditSummary.toolsUsed.join(", ") : "none") : "--"}</div>
              <div>Result type: {auditSummary?.resultType ?? "--"}</div>
              <div>Risk notes: {auditSummary?.riskNotes || "--"}</div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default App;
