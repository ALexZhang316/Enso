export type ToolBias = "eager" | "balanced" | "minimal";

export const MODES = [
  {
    id: "default",
    label: "\u9ed8\u8ba4",
    description: "\u5e73\u8861\u56de\u7b54\u3001\u8f7b\u91cf\u68c0\u7d22\u4e0e\u8f7b\u91cf\u5de5\u5177\u4f7f\u7528\u7684\u65e5\u5e38\u6a21\u5f0f\u3002",
    retrievalDefault: false,
    historyWindow: 12,
    toolBias: "balanced" as ToolBias,
    temperature: 0.7,
    maxTokens: 1024
  },
  {
    id: "deep-dialogue",
    label: "\u6df1\u5ea6\u5bf9\u8bdd",
    description: "\u4ee5\u8fde\u7eed\u6027\u4e3a\u6838\u5fc3\u7684\u957f\u5bf9\u8bdd\u6a21\u5f0f\uff0c\u51cf\u5c11\u4e0d\u5fc5\u8981\u7684\u8ffd\u95ee\u3002",
    retrievalDefault: false,
    historyWindow: 24,
    toolBias: "minimal" as ToolBias,
    temperature: 0.9,
    maxTokens: 4096
  },
  {
    id: "decision",
    label: "\u51b3\u7b56",
    description: "\u5bf9\u9009\u9879\u8fdb\u884c\u6bd4\u8f83\uff0c\u660e\u786e\u533a\u5206\u4e8b\u5b9e\u3001\u5047\u8bbe\u4e0e\u5224\u65ad\u3002",
    retrievalDefault: true,
    historyWindow: 12,
    toolBias: "balanced" as ToolBias,
    temperature: 0.5,
    maxTokens: 2048
  },
  {
    id: "research",
    label: "\u7814\u7a76",
    description: "\u4ee5\u8bc1\u636e\u4e3a\u4e2d\u5fc3\u8fdb\u884c\u7efc\u5408\u5206\u6790\uff0c\u56de\u7b54\u53ef\u8ffd\u6eaf\u6765\u6e90\u3002",
    retrievalDefault: true,
    historyWindow: 16,
    toolBias: "eager" as ToolBias,
    temperature: 0.4,
    maxTokens: 4096
  }
] as const;

export type ModeId = (typeof MODES)[number]["id"];

export const DEFAULT_MODE: ModeId = "default";

export const OPTIONAL_MODES = MODES.filter((m) => m.id !== "default");

/** 根据模式 ID 查询该模式是否默认启用检索 */
export const getRetrievalDefault = (modeId: ModeId): boolean =>
  MODES.find((m) => m.id === modeId)?.retrievalDefault ?? false;

/** 根据模式 ID 查询历史消息窗口大小 */
export const getHistoryWindow = (modeId: ModeId): number =>
  MODES.find((m) => m.id === modeId)?.historyWindow ?? 12;

/** 根据模式 ID 查询工具使用倾向 */
export const getToolBias = (modeId: ModeId): ToolBias =>
  MODES.find((m) => m.id === modeId)?.toolBias ?? "balanced";

/** 根据模式 ID 查询采样温度 */
export const getTemperature = (modeId: ModeId): number =>
  MODES.find((m) => m.id === modeId)?.temperature ?? 0.7;

/** 根据模式 ID 查询最大生成 token 数 */
export const getMaxTokens = (modeId: ModeId): number =>
  MODES.find((m) => m.id === modeId)?.maxTokens ?? 1024;
