import { ModeId, OPTIONAL_MODES } from "@shared/modes";
import { Conversation } from "@shared/types";
import { Card, CardContent } from "@renderer/components/ui/card";
import { ScrollArea } from "@renderer/components/ui/scroll-area";

export type CenterView = "chat" | "knowledge" | "settings" | "audits";

export interface LeftPanelProps {
  activeMode: ModeId;
  isLoading: boolean;
  isSubmitting: boolean;
  conversations: Conversation[];
  activeConversationId: string;
  centerView: CenterView;
  onModeSelect: (mode: ModeId) => void;
  onCreateConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (conversation: Conversation) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleCenterView: (view: CenterView) => void;
}

const LeftPanel = (props: LeftPanelProps): JSX.Element => {
  const {
    activeMode,
    isLoading,
    isSubmitting,
    conversations,
    activeConversationId,
    centerView,
    onModeSelect,
    onCreateConversation,
    onSelectConversation,
    onRenameConversation,
    onDeleteConversation,
    onTogglePin,
    onToggleCenterView
  } = props;

  return (
    <aside className="flex h-full min-h-0 flex-col gap-2.5" data-testid="left-rail">
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
                onClick={() => onModeSelect(mode.id)}
                disabled={isLoading || isSubmitting}
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-0 flex-1 overflow-hidden">
        <CardContent className="flex h-full flex-col p-0">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {"\u4f1a\u8bdd"}
            </div>
            <button
              data-testid="conversation-create-button"
              className="text-[13px] font-medium text-primary hover:text-primary/80 transition-colors"
              onClick={onCreateConversation}
              type="button"
            >
              {"\u65b0\u5efa"}
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
                  onClick={() => onSelectConversation(conversation.id)}
                  onDoubleClick={() => onRenameConversation(conversation)}
                >
                  <div className="flex items-center justify-between">
                    <span className={`truncate ${conversation.pinned ? "font-medium" : ""}`}>
                      {conversation.pinned ? "\ud83d\udccc " : ""}
                      {conversation.title}
                    </span>
                    <div
                      className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                        conversation.id === activeConversationId ? "opacity-100" : ""
                      }`}
                    >
                      <button
                        className={`rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${
                          conversation.id === activeConversationId
                            ? "hover:bg-white/20 text-white/80"
                            : "hover:bg-black/[0.06] text-muted-foreground"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(conversation.id);
                        }}
                        type="button"
                      >
                        {conversation.pinned ? "\u53d6\u56fa" : "\u7f6e\u9876"}
                      </button>
                      <button
                        className={`rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${
                          conversation.id === activeConversationId
                            ? "hover:bg-white/20 text-white/80"
                            : "hover:bg-red-50 text-red-400"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conversation.id);
                        }}
                        type="button"
                      >
                        {"\u5220\u9664"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="shrink-0">
        <CardContent className="p-2 space-y-0.5">
          {[
            { key: "knowledge" as CenterView, label: "\u77e5\u8bc6\u5e93", testId: "nav-knowledge-button" },
            { key: "settings" as CenterView, label: "\u8bbe\u7f6e", testId: "nav-settings-button" },
            { key: "audits" as CenterView, label: "\u5ba1\u8ba1\u8bb0\u5f55", testId: "nav-audits-button" }
          ].map((nav) => (
            <button
              key={nav.key}
              data-testid={nav.testId}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] transition-all duration-150 ${
                centerView === nav.key
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground/70 hover:bg-black/[0.04]"
              }`}
              onClick={() => onToggleCenterView(nav.key)}
              disabled={isLoading || isSubmitting}
              type="button"
            >
              {nav.label}
            </button>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
};

export default LeftPanel;
