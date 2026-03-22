/**
 * Post-flight documentation update checker.
 *
 * 1. Checks whether the three mandatory documentation files have been modified
 *    in the current git working tree (staged or unstaged).
 * 2. Scans all instruction and doc files for deprecated keywords that indicate
 *    stale references to removed features or renamed fields.
 * 3. Checks that all versioned docs share the same version number.
 *
 * Exit code is always 0 (advisory, not blocking).
 * Warnings are printed for any issue found.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const REQUIRED_DOCS = [
  "CHANGELOG.md",
  "TODO_LIMITATIONS.md",
  "docs/codebase-contract.md"
];

// Files to scan for deprecated keywords (instruction + doc files)
const SCANNED_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "docs/baseline.md",
  "docs/codebase-contract.md",
  "docs/architecture.md",
  "docs/environment-and-github-bootstrap.md",
  "docs/spec/brain.md",
  "docs/spec/permission.md",
  "docs/spec/context.md",
  "docs/spec/tools.md",
  "docs/spec/ui.md",
  "docs/spec/audit.md",
  "config/default.toml"
];

// Deprecated keywords that should not appear outside of changelog/history context.
// Each entry: [regex, description of what replaced it]
const DEPRECATED_PATTERNS = [
  [/readOnlyDefault/g, "old permission boolean (replaced by per-action permission map)"],
  [/requireConfirmationForWrites/g, "old permission boolean (replaced by per-action permission map)"],
  [/requireDoubleConfirmationForExternal/g, "old permission boolean (replaced by per-action permission map)"],
  [/\breducedQuestioning\b/g, "old expression field (removed)"],
  [/\bdefaultAssumption\b/g, "old expression field (removed)"],
  [/\briskLabeling\b/g, "old expression field (removed)"],
  [/["']style["']\s*[:=]\s*["'](direct|balanced)["']/g, "old expression.style field (replaced by density)"],
  [/vector.store/gi, "vector store not implemented (current: SQLite FTS)"],
  [/\bembeddings\b/gi, "embeddings not implemented (current: SQLite FTS)"],
  [/double.confirm/gi, "double confirmation removed (replaced by per-action block/confirm/allow)"]
];

// Files where deprecated keywords are expected (changelog, contract history sections)
const HISTORY_FILES = new Set(["CHANGELOG.md", "docs/codebase-contract.md"]);

// Versioned doc files (should all share the same version)
const VERSIONED_DOCS = [
  "docs/baseline.md",
  "docs/codebase-contract.md",
  "docs/architecture.md",
  "docs/environment-and-github-bootstrap.md"
];

function getChangedFiles() {
  try {
    const staged = execSync("git diff --cached --name-only", {
      encoding: "utf-8",
      cwd: ROOT
    }).trim();

    const unstaged = execSync("git diff --name-only", {
      encoding: "utf-8",
      cwd: ROOT
    }).trim();

    const untracked = execSync("git ls-files --others --exclude-standard", {
      encoding: "utf-8",
      cwd: ROOT
    }).trim();

    const allFiles = [staged, unstaged, untracked]
      .filter(Boolean)
      .join("\n")
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    return new Set(allFiles);
  } catch {
    console.log("[INFO] Unable to run git commands. Skipping doc update check.");
    return new Set();
  }
}

function checkMandatoryDocs(changed) {
  console.log("--- Mandatory Doc Updates ---");
  console.log("");

  let warnings = 0;

  for (const doc of REQUIRED_DOCS) {
    if (changed.has(doc)) {
      console.log(`[OK]   ${doc} was modified.`);
    } else {
      console.log(`[WARN] ${doc} was NOT modified. Did you forget to update it?`);
      warnings += 1;
    }
  }

  return warnings;
}

function checkDeprecatedKeywords() {
  console.log("");
  console.log("--- Deprecated Keyword Scan ---");
  console.log("");

  let warnings = 0;

  for (const relPath of SCANNED_FILES) {
    const fullPath = path.join(ROOT, relPath);
    if (!fs.existsSync(fullPath)) continue;

    // Skip history files for this check -- they legitimately mention old names
    if (HISTORY_FILES.has(relPath)) continue;

    const content = fs.readFileSync(fullPath, "utf-8");

    for (const [pattern, description] of DEPRECATED_PATTERNS) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      const match = pattern.exec(content);
      if (match) {
        // Find line number
        const beforeMatch = content.slice(0, match.index);
        const lineNum = beforeMatch.split("\n").length;
        console.log(`[WARN] ${relPath}:${lineNum} contains deprecated keyword "${match[0]}" -- ${description}`);
        warnings += 1;
      }
    }
  }

  if (warnings === 0) {
    console.log("[OK]   No deprecated keywords found in instruction/doc files.");
  }

  return warnings;
}

function checkVersionAlignment() {
  console.log("");
  console.log("--- Doc Version Alignment ---");
  console.log("");

  const versionPattern = /^#\s+.+\s+v(\d+\.\d+\.\d+)/m;
  const versions = new Map();

  for (const relPath of VERSIONED_DOCS) {
    const fullPath = path.join(ROOT, relPath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf-8");
    const match = versionPattern.exec(content);
    if (match) {
      versions.set(relPath, match[1]);
    } else {
      versions.set(relPath, "(no version found)");
    }
  }

  const uniqueVersions = new Set(versions.values());

  if (uniqueVersions.size <= 1) {
    const ver = [...uniqueVersions][0] || "N/A";
    console.log(`[OK]   All ${versions.size} versioned docs are at v${ver}.`);
    return 0;
  }

  console.log(`[WARN] Version mismatch across docs:`);
  for (const [file, ver] of versions) {
    console.log(`       ${file} -> v${ver}`);
  }

  return 1;
}

function main() {
  console.log("");
  console.log("=== Post-flight: Documentation Update Check ===");
  console.log("");

  const changed = getChangedFiles();

  if (changed.size === 0) {
    console.log("[INFO] No changed files detected (clean working tree or no git).");
    console.log("[INFO] If you just committed, this is expected.");
    console.log("");
    return;
  }

  const w1 = checkMandatoryDocs(changed);
  const w2 = checkDeprecatedKeywords();
  const w3 = checkVersionAlignment();

  const totalWarnings = w1 + w2 + w3;

  console.log("");

  if (totalWarnings === 0) {
    console.log("All post-flight doc checks passed.");
  } else {
    console.log(
      `${totalWarnings} warning(s). Review before considering the task done.`
    );
  }

  console.log("");
}

main();
