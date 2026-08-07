import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const hookScript = path.join(packageRoot, "claude-plugin", "scripts", "lint-edited-file.mjs");
const localEslint = path.join(packageRoot, "node_modules", "eslint");

function makeConsumer({ eslint = true, plugin = true, config = true } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "code quality consumer "));
  const modules = path.join(root, "node_modules");
  mkdirSync(modules);
  writeFileSync(path.join(root, "package.json"), '{"type":"module","private":true}\n');

  if (eslint) symlinkSync(localEslint, path.join(modules, "eslint"), "dir");
  if (plugin) {
    symlinkSync(packageRoot, path.join(modules, "eslint-plugin-code-quality"), "dir");
  }
  if (config) {
    writeFileSync(
      path.join(root, "eslint.config.js"),
      'import codeQuality from "eslint-plugin-code-quality";\nexport default [...codeQuality.configs.recommended];\n',
    );
  }
  return root;
}

function runHook(root, filePath, { stdin, script = hookScript, env = {} } = {}) {
  const event = {
    hook_event_name: "PostToolUse",
    tool_name: "Edit",
    cwd: root,
    tool_input: filePath === undefined ? {} : { file_path: filePath },
  };
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    input: stdin ?? JSON.stringify(event),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...env },
  });
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
  return target;
}

test("passes a clean edited file", () => {
  const root = makeConsumer();
  write(root, "src/clean.js", "export const answer = 42;\n");
  const result = runHook(root, "src/clean.js");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
});

test("fails a changed file with a comment-quality diagnostic", () => {
  const root = makeConsumer();
  write(root, "src/fail.js", "// Previously this returned zero.\nexport const answer = 42;\n");
  const result = runHook(root, "src/fail.js");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no-historical-narration/);
  assert.match(result.stderr, /src[/\\]fail\.js/);
});

test("fails a changed file that exceeds the god-file limit", () => {
  const root = makeConsumer();
  const lines = Array.from({ length: 501 }, (_, index) => `export const value${index} = ${index};`);
  write(root, "src/god.js", `${lines.join("\n")}\n`);
  const result = runHook(root, "src/god.js");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /max-lines/);
});

test("supports relative, absolute, and spaced paths", () => {
  const root = makeConsumer();
  const absolute = write(root, "source files/clean file.js", "export const ok = true;\n");
  assert.equal(runHook(root, "source files/clean file.js").status, 0);
  assert.equal(runHook(root, absolute).status, 0);
});

test("ignores unsupported, missing, deleted, and absent paths", () => {
  const root = makeConsumer({ eslint: false, plugin: false, config: false });
  write(root, "notes.md", "not JavaScript\n");
  assert.equal(runHook(root, "notes.md").status, 0);
  assert.equal(runHook(root, "missing.js").status, 0);
  assert.equal(runHook(root, "deleted.ts").status, 0);
  assert.equal(runHook(root, undefined).status, 0);
});

test("rejects malformed stdin concisely", () => {
  const root = makeConsumer({ eslint: false, plugin: false, config: false });
  const result = runHook(root, undefined, { stdin: "{not-json" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^code-quality: received malformed hook JSON on stdin\n$/);
});

test("stays silent in a project without ESLint", () => {
  const root = makeConsumer({ eslint: false });
  write(root, "src/file.js", "export const ok = true;\n");
  const result = runHook(root, "src/file.js");
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /npm WARN|npx/);
});

test("reports a missing plugin through the consumer config", () => {
  const root = makeConsumer({ plugin: false });
  write(root, "src/file.js", "export const ok = true;\n");
  const result = runHook(root, "src/file.js");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /code-quality:/);
  assert.match(`${result.stdout}\n${result.stderr}`, /eslint-plugin-code-quality|Cannot find package/);
});

test("reports missing configuration", () => {
  const root = makeConsumer({ config: false });
  write(root, "src/file.js", "export const ok = true;\n");
  const result = runHook(root, "src/file.js");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /code-quality:/);
});

test("reports parser errors", () => {
  const root = makeConsumer();
  write(root, "src/broken.js", "export const = ;\n");
  const result = runHook(root, "src/broken.js");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Parsing error|Unexpected token/);
});

test("runs from a simulated versioned Claude plugin cache", () => {
  const root = makeConsumer();
  write(root, "src/cache-safe.js", "export const cacheSafe = true;\n");
  const cacheRoot = mkdtempSync(path.join(tmpdir(), "claude plugin cache "));
  const cachedPlugin = path.join(cacheRoot, "code-quality", "0.2.1");
  mkdirSync(path.join(cachedPlugin, "scripts"), { recursive: true });
  cpSync(hookScript, path.join(cachedPlugin, "scripts", "lint-edited-file.mjs"));

  const result = runHook(root, "src/cache-safe.js", {
    script: path.join(cachedPlugin, "scripts", "lint-edited-file.mjs"),
    env: { CLAUDE_PLUGIN_ROOT: cachedPlugin },
  });
  assert.equal(result.status, 0, result.stderr);
});
