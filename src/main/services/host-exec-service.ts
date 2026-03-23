import { spawnSync } from "node:child_process";
import path from "node:path";
import { HostExecPendingAction } from "../../shared/types";

const READ_ONLY_COMMAND_PATTERNS = [
  /^Get-ChildItem(?:\s|$)/i,
  /^dir(?:\s|$)/i,
  /^ls(?:\s|$)/i,
  /^tree(?:\s|$)/i,
  /^Test-Path(?:\s|$)/i,
  /^Get-Content(?:\s|$)/i,
  /^type(?:\s|$)/i,
  /^Select-String(?:\s|$)/i,
  /^findstr(?:\s|$)/i,
  /^where(?:\s|$)/i,
  /^Get-FileHash(?:\s|$)/i,
  /^Get-ItemProperty(?:\s|$)/i,
  /^hostname(?:\s|$)/i,
  /^whoami(?:\s|$)/i,
  /^Get-Date(?:\s|$)/i,
  /^Get-Location(?:\s|$)/i,
  /^Get-Process(?:\s|$)/i,
  /^systeminfo(?:\s|$)/i,
  /^node\s+--version\b/i,
  /^npm\s+(list|ls|outdated|--version)\b/i,
  /^Measure-Object(?:\s|$)/i,
  /^Start-Sleep(?:\s|$)/i
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

const DEFAULT_COMMAND_TIMEOUT_MS = 30000;
const GIT_OUTPUT_FLAGS = new Set(["-o", "--output"]);
const READ_ONLY_GIT_BRANCH_FLAGS = new Set([
  "-a",
  "--all",
  "-r",
  "--remotes",
  "-v",
  "--verbose",
  "-vv",
  "--list",
  "--show-current"
]);
const READ_ONLY_GIT_REMOTE_FLAGS = new Set(["-v", "--verbose"]);

const tokenizeCommand = (command: string): string[] => {
  const matches = command.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ""));
};

const isReadOnlyGitCommand = (command: string): boolean => {
  const parts = tokenizeCommand(command);
  if (parts.length < 2 || parts[0].toLowerCase() !== "git") {
    return false;
  }

  const subcommand = parts[1].toLowerCase();
  const args = parts.slice(2);

  switch (subcommand) {
    case "status":
    case "log":
      return true;
    case "diff":
    case "show":
      return !args.some((arg) => {
        const normalized = arg.toLowerCase();
        return normalized.startsWith("--output=") || GIT_OUTPUT_FLAGS.has(normalized);
      });
    case "branch":
      return args.every((arg) => READ_ONLY_GIT_BRANCH_FLAGS.has(arg.toLowerCase()));
    case "remote":
      return args.length === 0 || args.every((arg) => READ_ONLY_GIT_REMOTE_FLAGS.has(arg.toLowerCase()));
    default:
      return false;
  }
};

interface HostExecServiceOptions {
  timeoutMs?: number;
}

export interface HostExecRunResult {
  command: string;
  workingDirectory: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: string;
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
  private readonly timeoutMs: number;

  constructor(
    private readonly workspaceRoot: string,
    options: HostExecServiceOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  }

  isAllowedCommand(command: string): boolean {
    const normalized = command.trim();
    if (!normalized) {
      return false;
    }

    if (DISALLOWED_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return false;
    }

    const allowedByPattern = READ_ONLY_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized));
    const allowedByGitRule = isReadOnlyGitCommand(normalized);
    if (!allowedByPattern && !allowedByGitRule) {
      return false;
    }

    if (!this.commandArgsStayInsideWorkspace(normalized)) {
      return false;
    }

    return true;
  }

  private commandArgsStayInsideWorkspace(command: string): boolean {
    const resolvedRoot = path.resolve(this.workspaceRoot);
    const parts = tokenizeCommand(command).slice(1);

    for (const part of parts) {
      if (/^-/.test(part)) {
        continue;
      }

      if (/\$\(|`/.test(part)) {
        return false;
      }

      if (path.isAbsolute(part)) {
        const resolvedArg = path.resolve(part);
        if (resolvedArg !== resolvedRoot && !resolvedArg.startsWith(`${resolvedRoot}${path.sep}`)) {
          return false;
        }
      } else if (part.includes("..")) {
        const resolvedArg = path.resolve(resolvedRoot, part);
        if (resolvedArg !== resolvedRoot && !resolvedArg.startsWith(`${resolvedRoot}${path.sep}`)) {
          return false;
        }
      }
    }

    return true;
  }

  buildHostExecProposal(params: { requestText: string; command: string }): HostExecPendingAction {
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
      timeout: this.timeoutMs
    });

    const timedOut =
      result.error instanceof Error &&
      "code" in result.error &&
      result.error.code === "ETIMEDOUT";
    const errorMessage = result.error instanceof Error ? result.error.message : undefined;

    const stderrParts = [
      result.stderr ?? "",
      timedOut ? `Command timed out after ${this.timeoutMs}ms.` : "",
      errorMessage && !timedOut ? errorMessage : ""
    ].filter(Boolean);

    return {
      command: action.command,
      workingDirectory,
      exitCode: timedOut ? -1 : typeof result.status === "number" ? result.status : -1,
      stdout: truncateOutput(result.stdout ?? ""),
      stderr: truncateOutput(stderrParts.join("\n")),
      timedOut,
      error: timedOut ? `Command timed out after ${this.timeoutMs}ms.` : errorMessage
    };
  }

  verifyPendingAction(result: HostExecRunResult): boolean {
    return result.exitCode === 0 && !result.timedOut;
  }
}
