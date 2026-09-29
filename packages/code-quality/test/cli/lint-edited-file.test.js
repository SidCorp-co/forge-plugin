import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { tempRoom } from "../fixtures/room.js";

const packageRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const hookScript = path.join(packageRoot, "claude-plugin", "scripts", "lint-edited-file.mjs");
const localEslint = path.join(packageRoot, "node_modules", "eslint");

function makeConsumer({ eslint = true, plugin = true, config = true } = {}) {
  const root = tempRoom("code quality consumer ");
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

function runHook(root, filePath, { stdin, script = hookScript, env = {}, session, timeout } = {}) {
  const event = {
    hook_event_name: "PostToolUse",
    tool_name: "Edit",
    cwd: root,
    session_id: session,
    tool_input: filePath === undefined ? {} : { file_path: filePath },
  };
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    input: stdin ?? JSON.stringify(event),
    env: { ...process.env, TMPDIR: root, CLAUDE_PROJECT_DIR: root, ...env },
    timeout,
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

/* A worktree cut beside the checkout puts every file a run writes outside CLAUDE_PROJECT_DIR, and
   for months that meant the delegate exited 0 without a word (ISS-530). */
test("a file in a tree beside the session's directory is linted by that tree", () => {
  const session = makeConsumer();
  const worktree = makeConsumer();
  writeFileSync(path.join(worktree, ".git"), "gitdir: /elsewhere/.git/worktrees/one\n");
  const file = write(worktree, "src/fail.js", "// Previously this returned zero.\nexport const answer = 42;\n");
  const result = runHook(session, file);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /no-historical-narration/);
  assert.match(result.stderr, /src[/\\]fail\.js/);
});

test("a relative path is placed against the session's directory before the tree is chosen", () => {
  const session = makeConsumer();
  const worktree = makeConsumer();
  writeFileSync(path.join(worktree, ".git"), "gitdir: /elsewhere/.git/worktrees/one\n");
  write(worktree, "src/fail.js", "// Previously this returned zero.\nexport const answer = 42;\n");
  symlinkSync(path.join(worktree, "src"), path.join(session, "linked"), "dir");
  const result = runHook(session, "linked/fail.js");
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /no-historical-narration/);
});

test("a file beside the session's directory in no tree at all is still nobody's", () => {
  const session = makeConsumer();
  const loose = tempRoom("code quality loose ");
  const file = write(loose, "src/fail.js", "// Previously this returned zero.\nexport const answer = 42;\n");
  const result = runHook(session, file);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
});

test("fails a changed file that exceeds the god-file limit", () => {
  const root = makeConsumer();
  const lines = Array.from({ length: 501 }, (_, index) => `export const value${index} = ${index};`);
  write(root, "src/god.js", `${lines.join("\n")}\n`);
  const result = runHook(root, "src/god.js");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /max-lines/);
});

test("a god-file report carries the split directive and the fix policy", () => {
  const root = makeConsumer();
  const lines = Array.from({ length: 501 }, (_, index) => `export const value${index} = ${index};`);
  write(root, "src/god.js", `${lines.join("\n")}\n`);
  const { stderr } = runHook(root, "src/god.js");
  assert.match(stderr, /Split by responsibility, never at the line count/);
  assert.match(stderr, /Backend: a folder per feature/);
  assert.match(stderr, /Frontend: components\/, hooks\/, lib\//);
  assert.match(stderr, /no eslint-disable, no raised limit, no exemption entry/);
});

test("a comment report carries the fix policy but no split directive", () => {
  const root = makeConsumer();
  write(root, "src/fail.js", "// Previously this returned zero.\nexport const answer = 42;\n");
  const { stderr } = runHook(root, "src/fail.js");
  assert.match(stderr, /narrates history \("Previously"\)/);
  assert.match(stderr, /no eslint-disable, no raised limit, no exemption entry/);
  assert.doesNotMatch(stderr, /Split by responsibility/);
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

test("lints a monorepo package with that package's own ESLint", () => {
  const root = tempRoom("code quality monorepo ");
  writeFileSync(path.join(root, "package.json"), '{"private":true,"workspaces":["packages/*"]}\n');

  const workspace = path.join(root, "packages", "api");
  const modules = path.join(workspace, "node_modules");
  mkdirSync(modules, { recursive: true });
  symlinkSync(localEslint, path.join(modules, "eslint"), "dir");
  symlinkSync(packageRoot, path.join(modules, "eslint-plugin-code-quality"), "dir");
  writeFileSync(path.join(workspace, "package.json"), '{"type":"module","name":"api"}\n');
  writeFileSync(
    path.join(workspace, "eslint.config.js"),
    'import codeQuality from "eslint-plugin-code-quality";\nexport default [...codeQuality.configs.recommended];\n',
  );
  write(root, "packages/api/src/fail.js", "// Previously this returned zero.\nexport const a = 1;\n");

  const result = runHook(root, "packages/api/src/fail.js");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no-historical-narration/);
});

test("a rule the project set to warn does not block an edit", () => {
  const root = makeConsumer({ config: false });
  writeFileSync(
    path.join(root, "eslint.config.js"),
    'import { configure } from "eslint-plugin-code-quality";\n' +
      'export default configure({ "no-historical-narration": "warn", "comment-density": "warn" });\n',
  );
  write(root, "src/warn.js", "// Previously this returned zero.\nexport const answer = 42;\n");
  const result = runHook(root, "src/warn.js");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
});

test("rejects malformed stdin concisely", () => {
  const root = makeConsumer({ eslint: false, plugin: false, config: false });
  const result = runHook(root, undefined, { stdin: "{not-json" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^code-quality: received malformed hook JSON on stdin\n$/);
});

test("a project that switched the hook off is not linted on edit", () => {
  const root = makeConsumer();
  writeFileSync(path.join(root, "code-quality.json"), '{ "hook": false }\n');
  write(root, "src/fail.js", "// Previously this returned zero.\nexport const a = 1;\n");
  const off = runHook(root, "src/fail.js");
  assert.equal(off.status, 0, off.stderr);
  assert.equal(off.stderr, "");

  // The same edit, with the same file present and saying nothing about the hook.
  writeFileSync(path.join(root, "code-quality.json"), '{ "allRules": true }\n');
  assert.equal(runHook(root, "src/fail.js").status, 2);
});

// A stand-in for prettier, exercising the same three API calls the hook makes on the real one.
// `config` is what resolveConfig answers, and null is prettier's word for a project with none.
function installPrettier(
  root,
  config,
  format = "(text) => text.split('\\n').filter((l) => !l.startsWith('// Previously')).join('\\n')",
) {
  const home = path.join(root, "node_modules", "prettier");
  mkdirSync(home, { recursive: true });
  writeFileSync(
    path.join(home, "package.json"),
    '{"name":"prettier","version":"3.0.0","main":"./index.cjs"}\n',
  );
  writeFileSync(
    path.join(home, "index.cjs"),
    "module.exports = {\n" +
      "  getFileInfo: async (f) => ({ ignored: /ignored/.test(f), inferredParser: 'babel' }),\n" +
      `  resolveConfig: async () => (${JSON.stringify(config)}),\n` +
      `  format: async ${format},\n` +
      "};\n",
  );
}

test("the project's prettier runs first, so the rules judge the formatted file", () => {
  const root = makeConsumer();
  installPrettier(root, {});

  const file = write(root, "src/formatted.js", "// Previously this returned zero.\nexport const a = 1;\n");
  const result = runHook(root, "src/formatted.js");
  assert.equal(result.status, 0, result.stderr);
  // The finding is gone because the narration is, which only holds if formatting came first.
  assert.doesNotMatch(readFileSync(file, "utf8"), /Previously/);

  // A file prettier reports as ignored is not the hook's to rewrite, so the rules still see it.
  const ignored = write(root, "src/ignored.js", "// Previously this returned zero.\nexport const b = 1;\n");
  assert.equal(runHook(root, "src/ignored.js").status, 2);
  assert.match(readFileSync(ignored, "utf8"), /Previously/);
});

/* The delegate kills the hook at its time limit, and a kill between the truncate and the write of an
   in-place write-back left a file empty over sshfs (ISS-2819). The config below never finishes
   loading, so the kill lands inside the lint, after prettier has answered. */
test("a lint killed at its time limit leaves the file as the edit wrote it", () => {
  const root = makeConsumer({ config: false });
  installPrettier(root, {});
  writeFileSync(
    path.join(root, "eslint.config.js"),
    "const parent = process.ppid;\n" +
      "setInterval(() => { if (process.ppid !== parent) process.exit(1); }, 50);\n" +
      "await new Promise(() => {});\nexport default [];\n",
  );
  const source = "// Previously this returned zero.\nexport const a = 1;\n";
  const file = write(root, "src/slow.js", source);
  const result = runHook(root, "src/slow.js", { timeout: 2500 });
  assert.equal(result.error?.code, "ETIMEDOUT", result.stderr);
  assert.equal(readFileSync(file, "utf8"), source);
});

test("a reformatted file is replaced whole, keeping its mode and leaving nothing beside it", () => {
  const root = makeConsumer();
  installPrettier(root, {});
  const file = write(root, "src/kept.js", "// Previously this returned zero.\nexport const a = 1;\n");
  chmodSync(file, 0o640);
  const before = statSync(file);
  const result = runHook(root, "src/kept.js");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(file, "utf8"), "export const a = 1;\n");
  const after = statSync(file);
  // A new inode is the rename: an in-place write keeps the old one, truncated for a moment.
  assert.notEqual(after.ino, before.ino);
  assert.equal(after.mode & 0o777, 0o640);
  assert.deepEqual(readdirSync(path.dirname(file)), ["kept.js"]);
});

/* The text is linted on stdin, and only the name passed beside it picks the configuration: a rule
   scoped to one directory and an ignored directory answer as they do for a path lint. */
test("the lint of the text answers as a lint of the file by path does", () => {
  const root = makeConsumer({ plugin: false, config: false });
  writeFileSync(
    path.join(root, "eslint.config.js"),
    'export default [{ ignores: ["src/generated/**"] }, { files: ["src/strict/**"], rules: { "no-var": "error" } }];\n',
  );
  const eslint = path.join(localEslint, "bin", "eslint.js");
  for (const relative of ["src/strict/a.js", "src/loose/a.js", "src/generated/a.js"]) {
    write(root, relative, "var a = 1;\nexport { a };\n");
    const byPath = spawnSync(process.execPath, [eslint, "--format", "json", relative], {
      cwd: root,
      encoding: "utf8",
    });
    const rules = JSON.parse(byPath.stdout).flatMap((one) =>
      one.messages.filter((m) => m.severity === 2).map((m) => m.ruleId),
    );
    const hook = runHook(root, relative);
    assert.equal(hook.status, rules.length ? 2 : 0, `${relative}: ${hook.stderr}`);
    for (const rule of rules) assert.match(hook.stderr, new RegExp(`\\b${rule}\\b`), relative);
  }
  assert.match(runHook(root, "src/strict/a.js").stderr, /no-var/);
});

/* A stand-in prettier that joins a wrapped array onto one line, which is what the real one does to a
   wrapped signature: four code lines become one, and comment-density's budget with them. */
const JOIN = String.raw`(text) => text.replace("[\n  1,\n  2,\n]", "[1, 2]")`;
const WRAPPED = "export const list = [\n  1,\n  2,\n];\n";

function joiningConsumer(extraRules = "") {
  const root = makeConsumer({ config: false });
  writeFileSync(
    path.join(root, "eslint.config.js"),
    'import codeQuality from "eslint-plugin-code-quality";\n' +
      `export default [...codeQuality.configs.recommended${extraRules}];\n`,
  );
  installPrettier(root, {}, JOIN);
  return root;
}

/* The case ISS-1089 met: a file at its comment budget passes as written and fails once prettier has
   joined its lines, and the edit was refused for the formatter's line count. */
test("an edit whose own text passes is not refused for a finding only the formatting created", () => {
  const root = joiningConsumer();
  const source = `// The two numbers every caller here needs.\n${WRAPPED}`;
  const file = write(root, "src/budget.js", source);
  const result = runHook(root, "src/budget.js");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(file, "utf8"), source);
});

test("a finding the edit's own text shares is refused on the formatted file, saying it was formatted", () => {
  const root = joiningConsumer();
  const file = write(root, "src/over.js", `// Holds the two numbers every caller in this module needs today.\n${WRAPPED}`);
  const result = runHook(root, "src/over.js");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /comment-density/);
  assert.match(result.stderr, /Reformatted by the project's prettier before this lint/);
  assert.match(readFileSync(file, "utf8"), /\[1, 2\]/);
});

test("a withheld formatting leaves the edit's own findings, naming the rule it would have broken", () => {
  const root = joiningConsumer(', { rules: { "no-var": "error" } }');
  const source = `// The two numbers every caller here needs.\n${WRAPPED.replace("const", "var")}`;
  const file = write(root, "src/own.js", source);
  const result = runHook(root, "src/own.js");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no-var/);
  assert.match(result.stderr, /Not reformatted: the project's prettier output fails code-quality\/comment-density/);
  assert.doesNotMatch(result.stderr, /Cut \d+ characters of comment/);
  assert.equal(readFileSync(file, "utf8"), source);
});

test("a prettier with no configuration to read formats nothing, and the rules still run", () => {
  const root = makeConsumer();
  installPrettier(root, null);

  const source = "// Previously this returned zero.\nexport const a = 1;\n";
  const file = write(root, "src/unconfigured.js", source);
  const result = runHook(root, "src/unconfigured.js");
  // Byte-identical: the project chose no style, so prettier's defaults do not stand in for one.
  assert.equal(readFileSync(file, "utf8"), source);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no-historical-narration/);
});

test("stays silent in a project without ESLint", () => {
  const root = makeConsumer({ eslint: false, plugin: false, config: false });
  write(root, "src/file.js", "export const ok = true;\n");
  const result = runHook(root, "src/file.js");
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /npm WARN|npx/);
});

test("says so once when a project configured ESLint but did not install it", () => {
  const root = makeConsumer({ eslint: false });
  write(root, "src/file.js", "export const ok = true;\n");

  const first = runHook(root, "src/file.js", { session: "one" });
  assert.equal(first.status, 2);
  assert.match(first.stderr, /eslint\.config\.js/);
  assert.match(first.stderr, /not installed/);

  const second = runHook(root, "src/file.js", { session: "one" });
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stderr, "");
});

test("the install warning is per session, not once for all time", () => {
  const root = makeConsumer({ eslint: false });
  write(root, "src/file.js", "export const ok = true;\n");
  assert.equal(runHook(root, "src/file.js", { session: "one" }).status, 2);
  assert.equal(runHook(root, "src/file.js", { session: "two" }).status, 2);
});

// TMPDIR is the root above, so `stampRoom()` resolves inside it: the case reads the directory the
// script writes rather than asserting on a name it hard-codes.
function stampRoom(root) {
  const owned = readdirSync(root).filter((name) => name.startsWith("code-quality-said-"));
  assert.equal(owned.length, 1, `expected one stamp directory under ${root}, found ${owned}`);
  return path.join(root, owned[0]);
}

test("a stamp older than the bound is swept when the next one is written", () => {
  const root = makeConsumer({ eslint: false });
  write(root, "src/file.js", "export const ok = true;\n");

  assert.equal(runHook(root, "src/file.js", { session: "old" }).status, 2);
  const room = stampRoom(root);
  const [stale] = readdirSync(room);
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
  utimesSync(path.join(room, stale), twoDaysAgo, twoDaysAgo);

  assert.equal(runHook(root, "src/file.js", { session: "fresh" }).status, 2);
  const left = readdirSync(room);
  assert.ok(!left.includes(stale), `the stamp older than the bound survived: ${left}`);
  assert.equal(left.length, 1, `expected only the stamp just written, found ${left}`);
});

test("a stamp younger than the bound survives the sweep", () => {
  const root = makeConsumer({ eslint: false });
  write(root, "src/file.js", "export const ok = true;\n");

  assert.equal(runHook(root, "src/file.js", { session: "first" }).status, 2);
  assert.equal(runHook(root, "src/file.js", { session: "second" }).status, 2);
  assert.equal(readdirSync(stampRoom(root)).length, 2);
});

test("the sweep reads its own directory and never the temp root", () => {
  const root = makeConsumer({ eslint: false });
  write(root, "src/file.js", "export const ok = true;\n");
  // A leftover from the flat naming this fix replaces, and older than any bound.
  const strays = ["code-quality-said-deadbeefdeadbeef", "someone-elses-file"];
  const longAgo = new Date(Date.now() - 30 * 86_400_000);
  for (const name of strays) {
    writeFileSync(path.join(root, name), "");
    utimesSync(path.join(root, name), longAgo, longAgo);
  }

  assert.equal(runHook(root, "src/file.js", { session: "one" }).status, 2);
  for (const name of strays) {
    assert.ok(readdirSync(root).includes(name), `${name} was removed from the temp root`);
  }
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
  const cacheRoot = tempRoom("claude plugin cache ");
  const cachedPlugin = path.join(cacheRoot, "code-quality", "0.4.0");
  mkdirSync(path.join(cachedPlugin, "scripts"), { recursive: true });
  cpSync(hookScript, path.join(cachedPlugin, "scripts", "lint-edited-file.mjs"));

  const result = runHook(root, "src/cache-safe.js", {
    script: path.join(cachedPlugin, "scripts", "lint-edited-file.mjs"),
    env: { CLAUDE_PLUGIN_ROOT: cachedPlugin },
  });
  assert.equal(result.status, 0, result.stderr);
});
