// Enso v2 左侧面板
// 三个板块 Tab + 当前板块的会话列表 + 设置入口

import { BoardId, BOARDS } from "@shared/boards";
import { Conversation } from "@shared/types";
import { Card, CardContent } from "@renderer/components/ui/card";
import { ScrollArea } from "@renderer/components/ui/scroll-area";

export interface LeftPanelProps {
  activeBoard: BoardId;
  conversations: Conversation[];
  activeConversationId: string;
  isLoading: boolean;
  isStreaming: boolean;
  showSettings: boolean;
  onBoardSwitch: (board: BoardId) => void;
  onCreateConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (conversation: Conversation) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleSettings: () => void;
}

const LeftPanel = (props: LeftPanelProps): JSX.Element => {
  const {
    activeBoard,
    conversations,
    activeConversationId,
    isLoading,
    isStreaming,
    showSettings,
    onBoardSwitch,
    onCreateConversation,
    onSelectConversation,
    onRenameConversation,
    onDeleteConversation,
    onTogglePin,
    onToggleSettings
  } = props;

  const disabled = isLoading || isStreaming;

  return (
    <aside className="flex h-full min-h-0 flex-col gap-2.5" data-testid="left-panel">
      {/* 板块 Tab */}
      <Card className="shrink-0">
        <CardContent className="p-2.5">
          <div className="flex flex-col gap-1">
            {BOARDS.map((board) => (
              <button
                key={board.id}
                data-testid={`board-tab-${board.id}`}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] transition-all duration-150 ${
                  activeBoard === board.id
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "text-foreground/70 hover:bg-black/[0.04]"
                }`}
                onClick={() => onBoardSwitch(board.id)}
                disabled={disabled}
                type="button"
              >
                <div className="font-medium">{board.label}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 会话列表 */}
      <Card className="min-h-0 flex-1 overflow-hidden">
        <CardContent className="flex h-full flex-col p-0">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              历史会话
            </div>
            <button
              data-testid="conversation-create-button"
              className="text-[13px] font-medium text-primary hover:text-primary/80 transition-colors"
              onClick={onCreateConversation}
              disabled={disabled}
              type="button"
            >
              新建
            </button>
          </div>
          <ScrollArea className="flex-1 min-h-0 px-2 pb-2">
            <div className="space-y-0.5">
              {conversations.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12px] text-muted-foreground/40">
                  暂无会话
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    data-testid={`conversation-card-${conv.id}`}
                    className={`group rounded-xl px-3 py-2 text-[13px] transition-all duration-150 cursor-pointer ${
                      conv.id === activeConversationId
                        ? "bg-primary text-white"
                        : "text-foreground hover:bg-black/[0.04]"
                    }`}
                    onClick={() => onSelectConversation(conv.id)}
                    onDoubleClick={() => onRenameConversation(conv)}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`truncate ${conv.pinned ? "font-medium" : ""}`}>
                        {conv.pinned ? "📌 " : ""}
                        {conv.title}
                      </span>
                      <div
                        className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                          conv.id === activeConversationId ? "opacity-100" : ""
                        }`}
                      >
                        <button
                          className={`rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${
                            conv.id === activeConversationId
                              ? "hover:bg-white/20 text-white/80"
                              : "hover:bg-black/[0.06] text-muted-foreground"
                          }`}
                          onClick={(e) => { e.stopPropagation(); onTogglePin(conv.id); }}
                          type="button"
                        >
                          {conv.pinned ? "取固" : "置顶"}
                        </button>
                        <button
                          className={`rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${
                            conv.id === activeConversationId
                              ? "hover:bg-white/20 text-white/80"
                              : "hover:bg-red-50 text-red-400"
                          }`}
                          onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                          type="button"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 设置入口 */}
      <Card className="shrink-0">
        <CardContent className="p-2">
          <button
            data-testid="settings-button"
            className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] transition-all duration-150 ${
              showSettings
                ? "bg-primary/10 text-primary font-medium"
                : "text-foreground/70 hover:bg-black/[0.04]"
            }`}
            onClick={onToggleSettings}
            type="button"
          >
            设置
          </button>
        </CardContent>
      </Card>
    </aside>
  );
};

export default LeftPanel;
