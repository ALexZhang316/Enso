import { RetrievedSnippet } from "../../shared/types";

export interface ToolRunResult {
  toolName: "read" | "search" | "compute" | "exec";
  summary: string;
}

const hasComputeHint = (text: string): boolean =>
  /\b(calculate|compute|sum|average|multiply|divide)\b/i.test(text) ||
  /(计算|求和|平均|乘|除)/.test(text);

const hasSearchHint = (text: string): boolean =>
  /\b(search|find)\b/i.test(text) || /(搜索|查找)/.test(text);

const hasReadHint = (text: string): boolean =>
  /\b(read)\b/i.test(text) || /(读取|阅读)/.test(text);

const computeExpression = (input: string): string | null => {
  const matches = input.match(/[0-9+\-*/().\s]{3,}/g);
  if (!matches) {
    return null;
  }

  const candidate = matches.join(" ").trim();
  if (!candidate || !/^[0-9+\-*/().\s]+$/.test(candidate)) {
    return null;
  }

  try {
    const result = Function(`"use strict"; return (${candidate});`)();
    if (typeof result === "number" && Number.isFinite(result)) {
      return `${candidate} = ${result}`;
    }
    return null;
  } catch {
    return null;
  }
};

export class ToolService {
  decideAndRun(requestText: string, snippets: RetrievedSnippet[]): ToolRunResult | null {
    if (hasComputeHint(requestText)) {
      const computed = computeExpression(requestText);
      if (computed) {
        return {
          toolName: "compute",
          summary: computed
        };
      }
    }

    if (hasSearchHint(requestText) && snippets.length > 0) {
      return {
        toolName: "search",
        summary: `已检索导入知识，命中 ${snippets.length} 条相关片段。`
      };
    }

    if (hasReadHint(requestText) && snippets.length > 0) {
      const first = snippets[0];
      return {
        toolName: "read",
        summary: `已读取来源 ${first.sourceName} 作为上下文证据。`
      };
    }

    return null;
  }
}
