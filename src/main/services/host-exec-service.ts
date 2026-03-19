import { spawnSync } from "node:child_process";
import path from "node:path";
import { HostExecPendingAction } from "../../shared/types";

const READ_ONLY_COMMAND_PATTERNS = [
  /^Get-ChildItem(?:\s|$)/i,
  /^dir(?:\s|$)/i,
  /^ls(?:\s|$)/i,
  /^Get-Content(?:\s|$)/i,
  /^type(?:\s|$)/i,
  /^Select-String(?:\s|$)/i,
  /^findstr(?:\s|$)/i,
  /^where(?:\s|$)/i
] as const;

const DISALLOWED_COMMAND_PATTERNS = [
  /[;&]/,
  /\|\|/,
  /&&/,
  />/,
  /</,
  /^Remove-Item(?:\s|$)/i,
  /^del(?:\s|$)/i,
  /^rm(?:\s|$)/i,
  /^Move-Item(?:\s|$)/i,
  /^Rename-Item(?:\s|$)/i,
  /^Copy-Item(?:\s|$)/i,
  /^Set-Content(?:\s|$)/i,
  /^Add-Content(?:\s|$)/i,
  /^Out-File(?:\s|$)/i,
  /^Invoke-WebRequest(?:\s|$)/i,
  /^curl(?:\s|$)/i,
  /^Invoke-RestMethod(?:\s|$)/i,
  /^git\s+(push|pull|checkout|switch|commit|merge|rebase|clean|reset)\b/i,
  /^npm\s+(install|update|publish)\b/i,
  /^winget(?:\s|$)/i
] as const;

const COMMAND_TIMEOUT_MS = 15000;

export interface HostExecRunResult {
  command: string;
  workingDirectory: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class HostExecSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostExecSafetyError";
  }
}

const ensureInsideWorkspace = (workspaceRoot: string, candidatePath: string): string => {
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedCandidate = path.resolve(candidatePath);

  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new HostExecSafetyError("Refusing to execute outside the Enso workspace.");
  }

  return resolvedCandidate;
};

const truncateOutput = (value: string, maxLength = 1600): string => {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}\n...[truncated]`;
};

export class HostExecService {
  constructor(private readonly workspaceRoot: string) {}

  isAllowedCommand(command: string): boolean {
    const normalized = command.trim();
    if (!normalized) {
      return false;
    }

    if (DISALLOWED_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return false;
    }

    return READ_ONLY_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  buildHostExecProposal(params: {
    requestText: string;
    command: string;
  }): HostExecPendingAction {
    const command = params.command.trim();
    if (!this.isAllowedCommand(command)) {
      throw new HostExecSafetyError(
        "Only read-only host commands inside the Enso workspace can be proposed right now."
      );
    }

    return {
      kind: "host_exec",
      summary: `在工作区执行命令: ${command}`,
      command,
      workingDirectory: path.resolve(this.workspaceRoot),
      sourceRequestText: params.requestText,
      requestedAt: new Date().toISOString()
    };
  }

  executePendingAction(action: HostExecPendingAction): HostExecRunResult {
    if (action.kind !== "host_exec") {
      throw new HostExecSafetyError(`Unsupported pending action kind: ${action.kind}`);
    }

    if (!this.isAllowedCommand(action.command)) {
      throw new HostExecSafetyError(
        "Blocked host exec command. Only read-only commands inside the Enso workspace are supported."
      );
    }

    const workingDirectory = ensureInsideWorkspace(this.workspaceRoot, action.workingDirectory);
    const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", action.command], {
      cwd: workingDirectory,
      encoding: "utf8",
      windowsHide: true,
      timeout: COMMAND_TIMEOUT_MS
    });

    const stderrParts = [
      result.stderr ?? "",
      result.error instanceof Error ? result.error.message : ""
    ].filter(Boolean);

    return {
      command: action.command,
      workingDirectory,
      exitCode: typeof result.status === "number" ? result.status : -1,
      stdout: truncateOutput(result.stdout ?? ""),
      stderr: truncateOutput(stderrParts.join("\n"))
    };
  }

  verifyPendingAction(result: HostExecRunResult): boolean {
    return result.exitCode === 0;
  }
}
