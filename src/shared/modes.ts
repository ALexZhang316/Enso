export const MODES = [
  {
    id: "deep-dialogue",
    label: "深度对话",
    description: "以连续性为核心的长对话，减少不必要的追问。"
  },
  {
    id: "decision",
    label: "决策",
    description: "对选项进行比较，明确区分事实、假设与判断。"
  },
  {
    id: "research",
    label: "研究",
    description: "以证据为中心进行综合分析，回答可追溯来源。"
  }
] as const;

export type ModeId = (typeof MODES)[number]["id"];

export const DEFAULT_MODE: ModeId = "deep-dialogue";
