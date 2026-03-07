import { RetrievedSnippet } from "../../shared/types";

export interface ToolRunResult {
  toolName: "read" | "search" | "compute";
  summary: string;
}

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
    const normalized = requestText.toLowerCase();

    if (/\b(calculate|compute|sum|average|multiply|divide)\b/.test(normalized)) {
      const computed = computeExpression(requestText);
      if (computed) {
        return {
          toolName: "compute",
          summary: computed
        };
      }
    }

    if (/\bsearch\b/.test(normalized) && snippets.length > 0) {
      return {
        toolName: "search",
        summary: `Searched imported knowledge and found ${snippets.length} relevant snippet(s).`
      };
    }

    if (/\bread\b/.test(normalized) && snippets.length > 0) {
      const first = snippets[0];
      return {
        toolName: "read",
        summary: `Read source ${first.sourceName} for contextual evidence.`
      };
    }

    return null;
  }
}
