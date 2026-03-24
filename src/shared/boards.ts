// 三个板块定义：深度对话、投资决策、科研辅助
// 替代旧的 modes.ts，不再有"默认模式"

export type BoardId = "dialogue" | "decision" | "research";

export interface BoardDef {
  id: BoardId;
  label: string;
  description: string;
  temperature: number;
  maxTokens: number;
  historyWindow: number; // 发给模型的最大历史消息数
  hasTools: boolean; // 该板块是否启用工具调用
}

export const BOARDS: readonly BoardDef[] = [
  {
    id: "dialogue",
    label: "深度对话",
    description: "哲学、美学、宗教、文化、存在主义的长文字探讨",
    temperature: 0.9,
    maxTokens: 8192,
    historyWindow: 100, // 50 轮 × 2（user+assistant）
    hasTools: false
  },
  {
    id: "decision",
    label: "投资决策",
    description: "美股资产配置、信息收集、分析建议",
    temperature: 0.5,
    maxTokens: 4096,
    historyWindow: 48,
    hasTools: true
  },
  {
    id: "research",
    label: "科研辅助",
    description: "临床医学文献检索、数据分析、论文写作",
    temperature: 0.4,
    maxTokens: 8192,
    historyWindow: 48,
    hasTools: true
  }
] as const;

export const DEFAULT_BOARD: BoardId = "dialogue";

export const BOARD_MAP: Record<BoardId, BoardDef> = Object.fromEntries(
  BOARDS.map((b) => [b.id, b])
) as Record<BoardId, BoardDef>;

export const getBoardDef = (id: BoardId): BoardDef => BOARD_MAP[id];
