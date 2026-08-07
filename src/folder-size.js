import { readdirSync } from "node:fs";
import path from "node:path";

export const DEFAULT_MAX_FILES_PER_DIRECTORY = 20;

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
]);

/**
 * Counts source files directly inside each directory, never recursively: a
 * folder that grew wide is the finding, and its subfolders are the fix.
 */
export function findCrowdedDirectories({
  roots = ["."],
  max = DEFAULT_MAX_FILES_PER_DIRECTORY,
  ignoredDirectories = DEFAULT_IGNORED_DIRECTORIES,
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

    const files = [];
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
        queue.push(path.join(directory, entry.name));
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(entry.name);
      }
    }

    if (files.length > max) {
      violations.push({ directory, count: files.length, files: files.sort() });
    }
  }

  return violations.sort((a, b) => b.count - a.count || a.directory.localeCompare(b.directory));
}

export function formatCrowdedDirectories(violations, { cwd = process.cwd(), max } = {}) {
  return violations
    .map(({ directory, count }) => {
      const relative = path.relative(cwd, directory) || ".";
      return `${relative}\n  ${count} source files, limit ${max}. Group them into subdirectories by responsibility.`;
    })
    .join("\n\n");
}
