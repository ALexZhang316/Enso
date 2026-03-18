/**
 * Post-flight documentation update checker.
 *
 * Checks whether the three mandatory documentation files have been modified
 * in the current git working tree (staged or unstaged).
 *
 * Exit code is always 0 (advisory, not blocking).
 * Warnings are printed for any file that was NOT modified.
 */

const { execSync } = require("child_process");
const path = require("path");

const REQUIRED_DOCS = [
  "CHANGELOG.md",
  "TODO_LIMITATIONS.md",
  "docs/codebase-contract.md"
];

function getChangedFiles() {
  try {
    // Get both staged and unstaged changes
    const staged = execSync("git diff --cached --name-only", {
      encoding: "utf-8",
      cwd: path.resolve(__dirname, "..")
    }).trim();

    const unstaged = execSync("git diff --name-only", {
      encoding: "utf-8",
      cwd: path.resolve(__dirname, "..")
    }).trim();

    // Also check untracked files (new files not yet staged)
    const untracked = execSync("git ls-files --others --exclude-standard", {
      encoding: "utf-8",
      cwd: path.resolve(__dirname, "..")
    }).trim();

    const allFiles = [staged, unstaged, untracked]
      .filter(Boolean)
      .join("\n")
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    return new Set(allFiles);
  } catch {
    // If git is not available or not a repo, return empty set
    console.log("[INFO] Unable to run git commands. Skipping doc update check.");
    return new Set();
  }
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

  let warnings = 0;

  for (const doc of REQUIRED_DOCS) {
    if (changed.has(doc)) {
      console.log(`[OK]   ${doc} was modified.`);
    } else {
      console.log(`[WARN] ${doc} was NOT modified. Did you forget to update it?`);
      warnings += 1;
    }
  }

  console.log("");

  if (warnings === 0) {
    console.log("All mandatory docs updated. Post-flight doc check passed.");
  } else {
    console.log(
      `${warnings} doc(s) not updated. Review whether updates are needed before considering this task done.`
    );
  }

  console.log("");
}

main();
