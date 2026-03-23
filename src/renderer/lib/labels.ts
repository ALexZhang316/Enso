import { ModeId, MODES } from "@shared/modes";
import { PROVIDER_PRESET_MAP, ProviderId } from "@shared/providers";
import { AuditSummary, ChatMessage, EnsoConfig, StateSnapshot, TraceEntry, VerificationResult } from "@shared/types";

export const verificationStatusLabel = (status: VerificationResult["status"]): string => {
  switch (status) {
    case "passed":
      return "\u901a\u8fc7";
    case "skipped":
      return "\u8df3\u8fc7";
    case "blocked":
      return "\u88ab\u62e6\u622a";
    case "failed":
      return "\u5931\u8d25";
    default:
      return status;
  }
};

export const verificationStatusColor = (status: VerificationResult["status"]): string => {
  switch (status) {
    case "passed":
      return "text-green-600";
    case "skipped":
      return "text-yellow-600";
    case "blocked":
      return "text-orange-600";
    case "failed":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
};

export const tracePhaseLabel = (phase: TraceEntry["phase"]): string => {
  switch (phase) {
    case "classify":
      return "\u5206\u7c7b";
    case "plan":
      return "\u8ba1\u5212";
    case "retrieval":
      return "\u68c0\u7d22";
    case "tool":
      return "\u5de5\u5177";
    case "model":
      return "\u6a21\u578b";
    case "verification":
      return "\u9a8c\u8bc1";
    case "gate":
      return "\u95e8\u63a7";
    case "persist":
      return "\u6301\u4e45\u5316";
    default:
      return phase;
  }
};

export const modeLabel = (mode: ModeId): string => MODES.find((item) => item.id === mode)?.label ?? mode;

export const boolLabel = (value: boolean): string => (value ? "\u662f" : "\u5426");

export const densityLabel = (d: EnsoConfig["expression"]["density"]): string =>
  d === "concise" ? "\u7cbe\u7b80" : d === "detailed" ? "\u8be6\u5c3d" : "\u6807\u51c6";

export const granularityLabel = (g: EnsoConfig["reportingGranularity"]): string =>
  g === "result-level" ? "\u7ed3\u679c\u7ea7" : "\u65b9\u6848\u7ea7";

export const providerLabel = (providerId: ProviderId): string => PROVIDER_PRESET_MAP[providerId].label;

export const taskStatusLabel = (status: StateSnapshot["taskStatus"]): string => {
  switch (status) {
    case "idle":
      return "\u7a7a\u95f2";
    case "processing":
      return "\u5904\u7406\u4e2d";
    case "completed":
      return "\u5df2\u5b8c\u6210";
    case "awaiting_confirmation":
      return "\u7b49\u5f85\u786e\u8ba4";
    default:
      return status;
  }
};

export const roleLabel = (role: ChatMessage["role"]): string => {
  switch (role) {
    case "user":
      return "Alex";
    case "assistant":
      return "Enso";
    case "system":
      return "\u7cfb\u7edf";
    default:
      return role;
  }
};

export const handlingClassLabel = (value: string): string => {
  switch (value) {
    case "pure-dialogue":
      return "\u7eaf\u5bf9\u8bdd";
    case "retrieval-enhanced":
      return "\u68c0\u7d22\u589e\u5f3a";
    case "tool-assisted":
      return "\u5de5\u5177\u8f85\u52a9";
    case "action-adjacent":
      return "\u52a8\u4f5c\u90bb\u8fd1";
    default:
      return value;
  }
};

export const resultTypeLabel = (value: AuditSummary["resultType"]): string => {
  switch (value) {
    case "answer":
      return "\u56de\u7b54";
    case "proposal":
      return "\u63d0\u6848";
    case "dry_run":
      return "\u6f14\u7ec3";
    default:
      return value;
  }
};
