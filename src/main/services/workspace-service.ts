import fs from "node:fs";
import path from "node:path";
import { WorkspaceWritePendingAction } from "../../shared/types";

const WORKSPACE_SUBDIRS = ["tasks", "scratch", "outputs", "cache", "logs"] as const;

const toTimestampSlug = (input: string): string => input.replace(/[:.]/g, "-");

const sanitizeStem = (input: string): string => {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || "artifact";
};

const deriveStem = (requestText: string): string => {
  const explicit = requestText.match(/([a-zA-Z0-9][a-zA-Z0-9._-]{0,80})\.(md|txt|json|csv)\b/i);
  if (explicit) {
    return sanitizeStem(explicit[1]);
  }

  if (/(纪要|总结|摘要|报告)/.test(requestText)) {
    return "summary";
  }
  if (/(待办|todo|task|checklist)/i.test(requestText)) {
    return "todo";
  }
  if (/(笔记|note)/i.test(requestText)) {
    return "note";
  }

  return sanitizeStem(requestText.slice(0, 48));
};

export class WorkspaceService {
  constructor(private readonly workspaceRoot: string) {
    this.ensureWorkspace();
  }

  getRootPath(): string {
    this.ensureWorkspace();
    return this.workspaceRoot;
  }

  buildWorkspaceWriteProposal(params: { requestText: string; content: string }): WorkspaceWritePendingAction {
    const stem = deriveStem(params.requestText);
    const fileName = `${stem}-${toTimestampSlug(new Date().toISOString())}.md`;
    const targetPath = path.join(this.workspaceRoot, "outputs", fileName);

    return {
      kind: "workspace_write",
      summary: `向工作区写入 ${fileName}`,
      targetPath,
      content: params.content,
      sourceRequestText: params.requestText,
      requestedAt: new Date().toISOString()
    };
  }

  executePendingAction(action: WorkspaceWritePendingAction): { targetPath: string; bytesWritten: number } {
    this.ensureWorkspace();

    const resolvedRoot = path.resolve(this.workspaceRoot);
    const resolvedTarget = path.resolve(action.targetPath);
    if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error("Refusing to write outside the Enso workspace.");
    }

    fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
    fs.writeFileSync(resolvedTarget, action.content, "utf8");

    return {
      targetPath: resolvedTarget,
      bytesWritten: Buffer.byteLength(action.content, "utf8")
    };
  }

  verifyPendingAction(action: WorkspaceWritePendingAction): boolean {
    return fs.existsSync(path.resolve(action.targetPath));
  }

  private ensureWorkspace(): void {
    fs.mkdirSync(this.workspaceRoot, { recursive: true });
    for (const dirName of WORKSPACE_SUBDIRS) {
      fs.mkdirSync(path.join(this.workspaceRoot, dirName), { recursive: true });
    }
  }
}
