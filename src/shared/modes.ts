export const MODES = [
  {
    id: "deep-dialogue",
    label: "Deep Dialogue",
    description: "Long-form reflective dialogue with continuity and minimal unnecessary questioning."
  },
  {
    id: "decision",
    label: "Decision",
    description: "Option comparison with explicit separation of facts, assumptions, and judgment."
  },
  {
    id: "research",
    label: "Research",
    description: "Evidence-oriented synthesis with source-aware responses."
  }
] as const;

export type ModeId = (typeof MODES)[number]["id"];

export const DEFAULT_MODE: ModeId = "deep-dialogue";
