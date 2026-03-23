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

// 链式工具调用最大步数，防止失控
const MAX_TOOL_CHAIN_LENGTH = 3;

export class ToolService {
  constructor(private readonly deps: ToolServiceDependencies = {}) {}

  // 单工具调用（向后兼容）
  decideAndRun(requestText: string, snippets: RetrievedSnippet[]): ToolRunResult | null {
    const chain = this.decideAndRunChain(requestText, snippets);
    return chain.length > 0 ? chain[0] : null;
  }

  // 链式多工具调用：按优先级依次尝试匹配的工具，最多 MAX_TOOL_CHAIN_LENGTH 个
  // 例如 "搜索这个文件然后计算总价" 会同时触发 search + compute
  decideAndRunChain(requestText: string, snippets: RetrievedSnippet[]): ToolRunResult[] {
    const results: ToolRunResult[] = [];

    // 1. 尝试 search
    if (hasSearchHint(requestText) && snippets.length > 0) {
      const output = `已检索导入知识，命中 ${snippets.length} 条相关片段。`;
      results.push(buildToolRunResult({
        toolName: "search",
        success: true,
        output,
        summary: output
      }));
    }

    // 2. 尝试 read
    if (hasReadHint(requestText) && snippets.length > 0) {
      const first = snippets[0];
      const output = `已读取来源 ${first.sourceName} 作为上下文证据。`;
      results.push(buildToolRunResult({
        toolName: "read",
        success: true,
        output,
        summary: output
      }));
    }

    // 3. 尝试 compute（放最后，因为计算通常依赖前面检索的数据）
    if (hasComputeHint(requestText)) {
      const computed = computeExpression(requestText);
      if (computed) {
        results.push(buildToolRunResult({
          toolName: "compute",
          success: true,
          output: computed
        }));
      }
    }

    return results.slice(0, MAX_TOOL_CHAIN_LENGTH);
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
