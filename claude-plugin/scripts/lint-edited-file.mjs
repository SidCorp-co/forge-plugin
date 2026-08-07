#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

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

// A project without ESLint has opted out, not misconfigured itself. The hook is
// installed for every project this user opens, so it stays silent there.
function resolveEslint(projectRoot) {
  const anchor = path.join(projectRoot, "package.json");
  const require = createRequire(anchor);
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

  const messages = reports.flatMap((report) =>
    report.messages.map((message) => {
      const location = `${message.line ?? 1}:${message.column ?? 1}`;
      const rule = message.ruleId ? ` ${message.ruleId}` : "";
      return `${location} ${message.message}${rule}`;
    }),
  );
  if (messages.length === 0) {
    return conciseStderr(stderr) || "ESLint reported a setup, configuration, or parser error";
  }

  const shown = messages.slice(0, 10);
  if (messages.length > shown.length) shown.push(`…and ${messages.length - shown.length} more`);
  return shown.join("\n");
}

const event = readEvent();
const rawPath = getEditedPath(event);
if (!rawPath) process.exit(0);

const projectRoot = resolveProjectRoot(event);
const editedFile = resolveEditedFile(rawPath, projectRoot);
if (!editedFile) process.exit(0);

const eslintBin = resolveEslint(projectRoot);
if (!eslintBin) process.exit(0);

const result = spawnSync(
  process.execPath,
  [eslintBin, "--format", "json", "--no-cache", "--max-warnings", "0", editedFile],
  {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
  },
);

if (result.error) fail(`could not start ESLint: ${result.error.message}`);
if (result.status === 0) process.exit(0);

const diagnostic = formatLintOutput(result.stdout, result.stderr);
fail(`${path.relative(projectRoot, editedFile)}\n${diagnostic}`);
