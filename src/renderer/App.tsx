// Enso v2 主组件
// 两栏布局：左侧（板块 Tab + 会话列表 + 设置）、右侧（对话区）
// 删除了右侧面板、知识库、审计等旧功能

import { useCallback, useEffect, useMemo, useState } from "react";
import { BoardId, BOARDS, DEFAULT_BOARD } from "@shared/boards";
import { ProviderId, PROVIDER_MAP, PROVIDER_PRESETS } from "@shared/providers";
import { ChatMessage, Conversation, EnsoConfig } from "@shared/types";
import LeftPanel from "@renderer/components/LeftPanel";
import CenterPanel from "@renderer/components/CenterPanel";

// -- 工具函数 --
const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

// -- 主组件 --
const App = (): JSX.Element => {
  // -- 状态 --
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState("");
  const [config, setConfig] = useState<EnsoConfig | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [activeBoard, setActiveBoard] = useState<BoardId>(DEFAULT_BOARD);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerText, setComposerText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // 当前板块选择的模型提供商和模型
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("openai");
  const [selectedModel, setSelectedModel] = useState("");

  // -- 派生状态 --
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );

  // 当前板块的会话列表
  const boardConversations = useMemo(
    () => conversations.filter((c) => c.board === activeBoard),
    [conversations, activeBoard]
  );

  // -- 初始化 --
  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      try {
        const payload = await window.enso.initialize();
        setConfig(payload.config);
        setConversations(payload.conversations);
        setActiveConversationId(payload.activeConversationId);
        setMessages(payload.messages);

        // 设置初始板块和模型
        const activeConv = payload.conversations.find((c) => c.id === payload.activeConversationId);
        if (activeConv) {
          setActiveBoard(activeConv.board as BoardId);
        }
        setSelectedProvider(payload.config.activeProvider);
        const preset = PROVIDER_MAP[payload.config.activeProvider];
        setSelectedModel(preset?.defaultModel ?? "");
      } catch (error) {
        setInitError(toErrorMessage(error, "初始化失败。"));
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap().catch(() => {
      setInitError("初始化失败。");
      setIsLoading(false);
    });
  }, []);

  // -- 流式事件监听 --
  useEffect(() => {
    window.enso.onStreamChunk(({ delta }) => {
      setStreamingText((prev) => prev + delta);
    });
    window.enso.onStreamEnd(({ fullText, messageId }) => {
      setIsStreaming(false);
      setStreamingText("");
      // 用真实的消息替换流式文本
      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          conversationId: activeConversationId,
          role: "assistant" as const,
          content: fullText,
          createdAt: new Date().toISOString()
        }
      ]);
    });
    window.enso.onStreamError(({ error }) => {
      setIsStreaming(false);
      setStreamingText("");
      setSubmitError(error);
    });

    return () => {
      window.enso.removeAllStreamListeners();
    };
  }, [activeConversationId]);

  // -- 事件处理 --

  const handleBoardSwitch = useCallback(
    async (board: BoardId): Promise<void> => {
      setActiveBoard(board);
      setShowSettings(false);
      // 切换到该板块的会话列表，选择最近的一个或创建新的
      const boardConvs = conversations.filter((c) => c.board === board);
      if (boardConvs.length > 0) {
        const payload = await window.enso.selectConversation(boardConvs[0].id);
        setActiveConversationId(payload.activeConversationId);
        setMessages(payload.messages);
      } else {
        const payload = await window.enso.createConversation(board);
        setConversations(payload.conversations);
        setActiveConversationId(payload.activeConversationId);
        setMessages(payload.messages);
      }
      setComposerText("");
      setSubmitError("");
    },
    [conversations]
  );

  const handleCreateConversation = useCallback(async (): Promise<void> => {
    const payload = await window.enso.createConversation(activeBoard);
    setConversations(payload.conversations);
    setActiveConversationId(payload.activeConversationId);
    setMessages(payload.messages);
    setComposerText("");
    setSubmitError("");
    setShowSettings(false);
  }, [activeBoard]);

  const handleSelectConversation = useCallback(async (id: string): Promise<void> => {
    const payload = await window.enso.selectConversation(id);
    setActiveConversationId(payload.activeConversationId);
    setMessages(payload.messages);
    setComposerText("");
    setSubmitError("");
    setShowSettings(false);
  }, []);

  const handleRenameConversation = useCallback(async (conv: Conversation): Promise<void> => {
    const title = window.prompt("重命名会话", conv.title)?.trim();
    if (!title) return;
    const updated = await window.enso.renameConversation(conv.id, title);
    setConversations(updated);
  }, []);

  const handleDeleteConversation = useCallback(
    async (id: string): Promise<void> => {
      if (!window.confirm("确认删除该会话吗？")) return;
      const payload = await window.enso.deleteConversation(id);
      setConversations(payload.conversations);
      setActiveConversationId(payload.activeConversationId);
      setMessages(payload.messages);
    },
    []
  );

  const handleTogglePin = useCallback(async (id: string): Promise<void> => {
    const updated = await window.enso.togglePinConversation(id);
    setConversations(updated);
  }, []);

  const handleSend = useCallback(async (): Promise<void> => {
    const text = composerText.trim();
    if (!text || !activeConversationId || isStreaming) return;

    setSubmitError("");
    setIsStreaming(true);
    setStreamingText("");

    // 乐观更新：立即显示用户消息
    const optimisticMsg: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      conversationId: activeConversationId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setComposerText("");

    try {
      await window.enso.sendMessage({
        conversationId: activeConversationId,
        board: activeBoard,
        text,
        providerId: selectedProvider,
        model: selectedModel
      });
    } catch (error) {
      setIsStreaming(false);
      setSubmitError(toErrorMessage(error, "发送失败。"));
    }
  }, [composerText, activeConversationId, isStreaming, activeBoard, selectedProvider, selectedModel]);

  const handleCancelStream = useCallback(async (): Promise<void> => {
    await window.enso.cancelStream(activeConversationId);
    setIsStreaming(false);
    setStreamingText("");
  }, [activeConversationId]);

  // -- 初始化错误视图 --
  if (initError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
          <div className="text-lg font-semibold mb-2">初始化失败</div>
          <div className="text-sm text-gray-500 mb-4">{initError}</div>
          <button
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  // -- 主布局：两栏 --
  return (
    <div className="h-full overflow-hidden p-3" data-testid="layout-root">
      <div className="grid h-full grid-cols-[240px_1fr] gap-3">
        <LeftPanel
          activeBoard={activeBoard}
          conversations={boardConversations}
          activeConversationId={activeConversationId}
          isLoading={isLoading}
          isStreaming={isStreaming}
          showSettings={showSettings}
          onBoardSwitch={(b) => void handleBoardSwitch(b)}
          onCreateConversation={() => void handleCreateConversation()}
          onSelectConversation={(id) => void handleSelectConversation(id)}
          onRenameConversation={(c) => void handleRenameConversation(c)}
          onDeleteConversation={(id) => void handleDeleteConversation(id)}
          onTogglePin={(id) => void handleTogglePin(id)}
          onToggleSettings={() => setShowSettings((prev) => !prev)}
        />

        <CenterPanel
          isLoading={isLoading}
          isStreaming={isStreaming}
          activeConversation={activeConversation}
          messages={messages}
          streamingText={streamingText}
          composerText={composerText}
          submitError={submitError}
          showSettings={showSettings}
          config={config}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onComposerTextChange={setComposerText}
          onSend={() => void handleSend()}
          onCancelStream={() => void handleCancelStream()}
          onProviderChange={setSelectedProvider}
          onModelChange={setSelectedModel}
          onConfigChange={setConfig}
        />
      </div>
    </div>
  );
};

export default App;
