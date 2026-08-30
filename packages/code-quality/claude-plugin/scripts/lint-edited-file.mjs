#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Deliberately duplicates SOURCE_EXTENSIONS from src/folder-size.js. Claude Code installs
// claude-plugin/ alone into a versioned cache directory, so nothing here can import from the
// package at runtime; test/cli/plugin-isolation.test.js pins the copies together instead.
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

// Duplicated from src/directives.js for the same reason, and pinned by the same test.
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
    const config = CONFIG_NAMES.find((name) => existsSync(path.join(directory, name)));
    if (config) return { directory, config };
    if (!fallback && existsSync(path.join(directory, "package.json"))) fallback = directory;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return { directory: fallback ?? projectRoot, config: null };
}

// `"hook": false` in code-quality.json, read from the workspace owning the edited file and then the
// repository root. The hook is enabled once for every project this user opens, so opting one out
// has to be the project's own say.
function hookDisabled(directories) {
  return directories.some((directory) => {
    try {
      return JSON.parse(readFileSync(path.join(directory, "code-quality.json"), "utf8")).hook === false;
    } catch {
      return false;
    }
  });
}

function resolveEslint(require) {
  try {
    const packageJson = require.resolve("eslint/package.json");
    return path.join(path.dirname(packageJson), "bin", "eslint.js");
  } catch {
    return null;
  }
}

/** Whether this session was already told, recorded outside the tree the message describes. */
function alreadySaid(sessionId, subject) {
  const key = createHash("sha1").update(`${sessionId ?? ""}\0${subject}`).digest("hex").slice(0, 16);
  const stamp = path.join(tmpdir(), `code-quality-said-${key}`);
  if (existsSync(stamp)) return true;
  try {
    writeFileSync(stamp, "");
  } catch {
    // A stamp we cannot write means we say it again, which is the safe direction.
  }
  return false;
}

/**
 * Prettier first, so a formatting nit is never one of the errors blocking an edit, and only where
 * the project installed it. In process, not through the CLI: this runs after every edit, and a
 * second Node start would cost more than the whole check. `getFileInfo` answers what
 * `--ignore-unknown` and .prettierignore answer between them, and a failure is ESLint's to report
 * with a line and a column.
 */
async function format(require, file) {
  const whole = (api) =>
    ["getFileInfo", "resolveConfig", "format"].every((name) => typeof api?.[name] === "function");
  let prettier;
  try {
    // An ESM prettier exports its API directly; a CommonJS one arrives under `default`, and the
    // named exports Node lexes out of it are whichever ones it could see, so take neither on faith.
    const loaded = await import(pathToFileURL(require.resolve("prettier")).href);
    prettier = [loaded, loaded.default].find(whole);
  } catch {
    return;
  }
  if (prettier === undefined) return;
  try {
    const { ignored, inferredParser } = await prettier.getFileInfo(file, { resolveConfig: true });
    if (ignored || inferredParser === null) return;
    const options = await prettier.resolveConfig(file);
    const source = readFileSync(file, "utf8");
    const formatted = await prettier.format(source, { ...options, filepath: file });
    if (formatted !== source) writeFileSync(file, formatted);
  } catch {
    return;
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
// The extension test costs no I/O, so it settles the .md and .json edits before anything is read.
const editedFile = resolveEditedFile(rawPath, projectRoot);
if (!editedFile) process.exit(0);

const { directory: workspace, config } = resolveWorkspace(editedFile, projectRoot);
if (hookDisabled([workspace, projectRoot])) process.exit(0);

// Anchoring on the workspace lets Node's own upward lookup find either a package-level install
// or one hoisted to the repository root.
const require = createRequire(path.join(workspace, "package.json"));
const eslintBin = resolveEslint(require);
if (!eslintBin) {
  // Silence means two things and only one is a decision: no config is an opt-out, a config with
  // no ESLint behind it is a gate that reads as passing. Said once, because it stays true.
  if (config && !alreadySaid(event?.session_id, workspace)) {
    fail(
      `${path.relative(projectRoot, path.join(workspace, config))} configures ESLint, but ESLint ` +
        `is not installed in ${path.relative(projectRoot, workspace) || "."} — nothing is being ` +
        `checked on edit. Install the dependencies, or opt out with { "hook": false } in ` +
        `code-quality.json. This is said once per session.`,
    );
  }
  process.exit(0);
}

await format(require, editedFile);

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
