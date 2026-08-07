import { readdirSync } from "node:fs";
import path from "node:path";

export const DEFAULT_MAX_FILES_PER_DIRECTORY = 10;

export const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

// `worktrees` is here rather than left to the dot-directory skip: an agent worktree is a full
// checkout, and counting one repeats every finding once per worktree.
export const DEFAULT_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "vendor",
  "worktrees",
]);

/**
 * Counts source files directly inside each directory, never recursively: a
 * folder that grew wide is the finding, and its subfolders are the fix.
 */
export function findCrowdedDirectories({
  roots = ["."],
  max = DEFAULT_MAX_FILES_PER_DIRECTORY,
  ignoredDirectories = DEFAULT_IGNORED_DIRECTORIES,
  extensions = SOURCE_EXTENSIONS,
} = {}) {
  const violations = [];
  const seen = new Set();
  const queue = roots.map((root) => path.resolve(root));

  while (queue.length > 0) {
    const directory = queue.pop();
    if (seen.has(directory)) continue;
    seen.add(directory);

    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    let count = 0;
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
        queue.push(path.join(directory, entry.name));
      } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
        count += 1;
      }
    }

    if (count > max) violations.push({ directory, count });
  }

  return violations.sort((a, b) => b.count - a.count || a.directory.localeCompare(b.directory));
}
