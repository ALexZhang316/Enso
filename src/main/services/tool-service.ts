import path from "node:path";
import {
  HostExecPendingAction,
  RetrievedSnippet,
  ToolRunResult as SharedToolRunResult,
  WorkspaceWritePendingAction
} from "../../shared/types";
import { HostExecService } from "./host-exec-service";
import { WorkspaceService } from "./workspace-service";

interface LegacyToolRunResult {
  toolName: SharedToolRunResult["toolName"];
  summary: string;
}

export type ToolRunResult = (SharedToolRunResult & {
  summary: string;
}) | LegacyToolRunResult;

interface ToolServiceDependencies {
  workspaceService?: WorkspaceService;
  hostExecService?: HostExecService;
}

const hasComputeHint = (text: string): boolean =>
  /\b(calculate|compute|sum|average|multiply|divide)\b/i.test(text) || /(计算|求和|平均|乘|除)/.test(text);

const hasSearchHint = (text: string): boolean => /\b(search|find)\b/i.test(text) || /(搜索|查找)/.test(text);

const hasReadHint = (text: string): boolean => /\b(read)\b/i.test(text) || /(读取|阅读)/.test(text);

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

const buildToolRunResult = (params: {
  toolName: ToolRunResult["toolName"];
  success: boolean;
  output: string;
  sideEffects?: string[];
  error?: string;
  summary?: string;
}): ToolRunResult => ({
  toolName: params.toolName,
  success: params.success,
  output: params.output,
  sideEffects: params.sideEffects ?? [],
  error: params.error,
  summary: params.summary ?? (params.success ? params.output : params.error ?? params.output)
});

export class ToolService {
  constructor(private readonly deps: ToolServiceDependencies = {}) {}

  decideAndRun(requestText: string, snippets: RetrievedSnippet[]): ToolRunResult | null {
    if (hasComputeHint(requestText)) {
      const computed = computeExpression(requestText);
      if (computed) {
        return buildToolRunResult({
          toolName: "compute",
          success: true,
          output: computed
        });
      }
    }

    if (hasSearchHint(requestText) && snippets.length > 0) {
      const output = `已检索导入知识，命中 ${snippets.length} 条相关片段。`;
      return buildToolRunResult({
        toolName: "search",
        success: true,
        output,
        summary: output
      });
    }

    if (hasReadHint(requestText) && snippets.length > 0) {
      const first = snippets[0];
      const output = `已读取来源 ${first.sourceName} 作为上下文证据。`;
      return buildToolRunResult({
        toolName: "read",
        success: true,
        output,
        summary: output
      });
    }

    return null;
  }

  runWorkspaceWrite(action: WorkspaceWritePendingAction): ToolRunResult {
    if (!this.deps.workspaceService) {
      throw new Error("ToolService requires a WorkspaceService to run workspace-write actions.");
    }

    const result = this.deps.workspaceService.executePendingAction(action);
    const output = `Wrote ${result.bytesWritten} bytes to ${result.targetPath}`;

    return buildToolRunResult({
      toolName: "workspace-write",
      success: true,
      output,
      sideEffects: [`wrote:${result.targetPath}`],
      summary: `wrote ${path.basename(result.targetPath)}`
    });
  }

  runHostExec(action: HostExecPendingAction): ToolRunResult {
    if (!this.deps.hostExecService) {
      throw new Error("ToolService requires a HostExecService to run exec actions.");
    }

    const result = this.deps.hostExecService.executePendingAction(action);
    const success = this.deps.hostExecService.verifyPendingAction(result);
    const outputParts = [
      `Exit code: ${result.exitCode}`,
      result.stdout ? `STDOUT:\n${result.stdout}` : "",
      result.stderr ? `STDERR:\n${result.stderr}` : ""
    ].filter(Boolean);
    const error = success ? undefined : (result.error ?? result.stderr) || `Command failed: ${result.command}`;

    return buildToolRunResult({
      toolName: "exec",
      success,
      output: outputParts.join("\n\n"),
      sideEffects: [`exec:${result.command}`],
      error,
      summary: `exec ${action.command}`
    });
  }
}
