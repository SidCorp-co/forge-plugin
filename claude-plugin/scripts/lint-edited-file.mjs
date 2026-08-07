#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Deliberately duplicates SOURCE_EXTENSIONS from src/folder-size.js. Claude Code
// installs claude-plugin/ alone into a versioned cache directory, so nothing here
// can import from the package at runtime. test/plugin-isolation.test.js pins the
// two lists together instead.
const supportedExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

// Duplicated from src/directives.js for the same reason as supportedExtensions.
// test/plugin-isolation.test.js pins the strings to the package's copies.
const FIX_POLICY =
  "Fix the source, not the check: no eslint-disable, no raised limit, no exemption entry.";

const RULE_DIRECTIVES = {
  "max-lines":
    "Split by responsibility, never at the line count. Backend: a folder per feature (routes, service, repository). Frontend: components/, hooks/, lib/. Move whole exports and re-export them from the original path.",
  "max-lines-per-function":
    "Extract each independently testable step into a named function; split the file only if it then exceeds max-lines.",
};

function fail(message) {
  process.stderr.write(`code-quality: ${message}\n`);
  process.exit(2);
}

function readEvent() {
  let input;
  try {
    input = readFileSync(0, "utf8");
  } catch {
    fail("could not read the hook event from stdin");
  }

  try {
    return JSON.parse(input);
  } catch {
    fail("received malformed hook JSON on stdin");
  }
}

function getEditedPath(event) {
  const toolInput = event?.tool_input;
  if (!toolInput || typeof toolInput !== "object") return null;
  const candidate = toolInput.file_path ?? toolInput.notebook_path;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function resolveProjectRoot(event) {
  const candidate = process.env.CLAUDE_PROJECT_DIR || event?.cwd || process.cwd();
  return path.resolve(candidate);
}

function resolveEditedFile(rawPath, projectRoot) {
  const absolute = path.isAbsolute(rawPath)
    ? path.normalize(rawPath)
    : path.resolve(projectRoot, rawPath);

  if (!supportedExtensions.has(path.extname(absolute).toLowerCase())) return null;
  if (!existsSync(absolute)) return null;

  let stat;
  try {
    stat = lstatSync(absolute);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;

  const realProjectRoot = existsSync(projectRoot) ? realpathSync(projectRoot) : projectRoot;
  const realFile = realpathSync(absolute);
  const relative = path.relative(realProjectRoot, realFile);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return realFile;
}

const CONFIG_NAMES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
];

/**
 * The workspace that owns the edited file, which in a monorepo is a package
 * directory rather than the repository root. ESLint discovers flat config from
 * its working directory, so running from the wrong one silently applies the
 * wrong rules.
 */
function resolveWorkspace(editedFile, projectRoot) {
  let directory = path.dirname(editedFile);
  let fallback = null;
  while (directory.startsWith(projectRoot)) {
    if (CONFIG_NAMES.some((name) => existsSync(path.join(directory, name)))) return directory;
    if (!fallback && existsSync(path.join(directory, "package.json"))) fallback = directory;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return fallback ?? projectRoot;
}

// A project without ESLint has opted out, not misconfigured itself. The hook is
// installed for every project this user opens, so it stays silent there.
function resolveEslint(workspace) {
  // Anchoring on the workspace lets Node's own upward lookup find either a
  // package-level install or one hoisted to the repository root.
  const require = createRequire(path.join(workspace, "package.json"));
  try {
    const packageJson = require.resolve("eslint/package.json");
    return path.join(path.dirname(packageJson), "bin", "eslint.js");
  } catch {
    return null;
  }
}

function conciseStderr(stderr) {
  const lines = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "Oops! Something went wrong! :(");
  return lines.slice(0, 8).join("\n");
}

function formatLintOutput(stdout, stderr) {
  let reports;
  try {
    reports = JSON.parse(stdout || "[]");
  } catch {
    return conciseStderr(stderr) || "ESLint failed without readable diagnostics";
  }

  const errors = reports.flatMap((report) =>
    report.messages.filter((message) => message.severity === 2),
  );
  if (errors.length === 0) {
    return conciseStderr(stderr) || "ESLint reported a setup, configuration, or parser error";
  }

  const shown = errors.slice(0, 10).map((message) => {
    const location = `${message.line ?? 1}:${message.column ?? 1}`;
    const rule = message.ruleId ? ` ${message.ruleId}` : "";
    return `${location} ${message.message}${rule}`;
  });
  if (errors.length > shown.length) shown.push(`…and ${errors.length - shown.length} more`);

  // Derived from every error, not just the ten shown, so truncation cannot drop
  // the remedy for a rule that is still reported.
  const directives = [...new Set(errors.map(({ ruleId }) => RULE_DIRECTIVES[ruleId]))].filter(
    Boolean,
  );
  return [...shown, "", ...directives, FIX_POLICY].join("\n");
}

const event = readEvent();
const rawPath = getEditedPath(event);
if (!rawPath) process.exit(0);

const projectRoot = resolveProjectRoot(event);
const editedFile = resolveEditedFile(rawPath, projectRoot);
if (!editedFile) process.exit(0);

const workspace = resolveWorkspace(editedFile, projectRoot);
const eslintBin = resolveEslint(workspace);
if (!eslintBin) process.exit(0);

// No --max-warnings: severity is the project's decision, and a rule it enabled
// at `warn` should not block an edit.
const result = spawnSync(
  process.execPath,
  [eslintBin, "--format", "json", "--no-cache", editedFile],
  {
    cwd: workspace,
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
  },
);

if (result.error) fail(`could not start ESLint: ${result.error.message}`);
if (result.status === 0) process.exit(0);

const diagnostic = formatLintOutput(result.stdout, result.stderr);
fail(`${path.relative(projectRoot, editedFile)}\n${diagnostic}`);
