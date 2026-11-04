/* The edit hook lints the whole file, as it is meant to, but blocks for only what the edit is
   answerable for: a CRLF file keeps its endings where the project chose none, and a finding that
   predates the edit, on a line it left alone, no longer blocks it (ISS-25). */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { tempRoom } from "../fixtures/room.js";

const packageRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const hookScript = path.join(packageRoot, "claude-plugin", "scripts", "lint-edited-file.mjs");
const localEslint = path.join(packageRoot, "node_modules", "eslint");

function makeConsumer() {
  const root = tempRoom("code quality scope ");
  const modules = path.join(root, "node_modules");
  mkdirSync(modules);
  writeFileSync(path.join(root, "package.json"), '{"type":"module","private":true}\n');
  symlinkSync(localEslint, path.join(modules, "eslint"), "dir");
  symlinkSync(packageRoot, path.join(modules, "eslint-plugin-code-quality"), "dir");
  writeFileSync(
    path.join(root, "eslint.config.js"),
    'import codeQuality from "eslint-plugin-code-quality";\nexport default [...codeQuality.configs.recommended];\n',
  );
  return root;
}

function installPrettier(root, config, format) {
  const home = path.join(root, "node_modules", "prettier");
  mkdirSync(home, { recursive: true });
  writeFileSync(path.join(home, "package.json"), '{"name":"prettier","version":"3.0.0","main":"./index.cjs"}\n');
  writeFileSync(
    path.join(home, "index.cjs"),
    "module.exports = {\n" +
      "  getFileInfo: async () => ({ ignored: false, inferredParser: 'babel' }),\n" +
      `  resolveConfig: async () => (${JSON.stringify(config)}),\n` +
      `  format: async ${format},\n` +
      "};\n",
  );
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
  return target;
}

function runHook(root, file, stdin) {
  const event = stdin ?? JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Edit", cwd: root, tool_input: { file_path: file } });
  return spawnSync(process.execPath, [hookScript], {
    cwd: root,
    encoding: "utf8",
    input: event,
    env: { ...process.env, TMPDIR: root, CLAUDE_PROJECT_DIR: root },
  });
}

function editEvent(root, file, toolInput, toolName = "Edit") {
  return JSON.stringify({ hook_event_name: "PostToolUse", tool_name: toolName, cwd: root, tool_input: { file_path: file, ...toolInput } });
}

const NARRATION = "// Previously this returned zero.\n";

test("a CRLF file keeps its endings where the project set no endOfLine", () => {
  const root = makeConsumer();
  installPrettier(root, {}, "(text, options) => (options.endOfLine === 'auto' ? text : text.replace(/\\r\\n/g, '\\n'))");
  const file = write(root, "src/crlf.js", "export const a = 1;\r\nexport const b = 2;\r\n");
  const result = runHook(root, file);
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(file, "utf8"), /\r\n/, "the file's CRLF endings are preserved, not rewritten to LF");
});

test("a violation that predates the edit, on a line it left alone, does not block it", () => {
  const root = makeConsumer();
  const file = write(root, "src/predate.js", `${NARRATION}export const answer = 43;\n`);
  const result = runHook(root, file, editEvent(root, file, { old_string: "answer = 42", new_string: "answer = 43" }));
  assert.equal(result.status, 0, result.stderr);
});

test("a violation the edit introduces still blocks, the prior text being clean", () => {
  const root = makeConsumer();
  const file = write(root, "src/introduce.js", `${NARRATION}export const answer = 42;\n`);
  const result = runHook(root, file, editEvent(root, file, {
    old_string: "export const answer = 42;\n",
    new_string: `${NARRATION}export const answer = 42;\n`,
  }));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no-historical-narration/);
});

test("a whole-file Write names no prior text, so its violations still block", () => {
  const root = makeConsumer();
  const file = write(root, "src/wrote.js", `${NARRATION}export const answer = 42;\n`);
  const result = runHook(root, file, editEvent(root, file, { content: `${NARRATION}export const answer = 42;\n` }, "Write"));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no-historical-narration/);
});

test("a MultiEdit's predating violation is exempt, reversed edit by edit", () => {
  const root = makeConsumer();
  const file = write(root, "src/multi.js", `${NARRATION}export const a = 2;\nexport const b = 3;\n`);
  const result = runHook(root, file, editEvent(root, file, {
    edits: [{ old_string: "a = 1", new_string: "a = 2" }, { old_string: "b = 2", new_string: "b = 3" }],
  }, "MultiEdit"));
  assert.equal(result.status, 0, result.stderr);
});
