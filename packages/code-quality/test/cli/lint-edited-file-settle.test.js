/* The hook runs after every edit, so what it spends settling a path it then declines is spent on
   every .md and .json a session writes (ISS-560). These cases count the filesystem calls the hook
   process makes, and pin the outcomes the order of those calls must not move. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { tempRoom } from "../fixtures/room.js";

const packageRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const hookScript = path.join(packageRoot, "claude-plugin", "scripts", "lint-edited-file.mjs");
const localEslint = path.join(packageRoot, "node_modules", "eslint");

// Named imports of node:fs are live bindings that syncBuiltinESMExports refreshes, so the hook's
// own `import { existsSync } from "node:fs"` reaches the counting wrapper. Node's own loader
// resolving the entry script through the same wrapper, as 24.21 does after a preload, is no call of
// the hook's, so the entry's path is not counted.
const COUNTER = `
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
const calls = [];
for (const name of ["existsSync", "realpathSync", "lstatSync", "statSync"]) {
  const original = fs[name];
  fs[name] = function counted(...args) {
    if (String(args[0]) !== process.argv[1]) calls.push([name, String(args[0])]);
    return original.apply(this, args);
  };
}
syncBuiltinESMExports();
process.on("exit", () => process.stderr.write("fs-calls " + JSON.stringify(calls) + "\\n"));
`;

function counter() {
  const file = path.join(tempRoom("code quality counter "), "count-fs.mjs");
  writeFileSync(file, COUNTER);
  return pathToFileURL(file).href;
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
  return target;
}

function makeConsumer(prefix = "code quality settle ") {
  const root = tempRoom(prefix);
  mkdirSync(path.join(root, "node_modules"));
  writeFileSync(path.join(root, "package.json"), '{"type":"module","private":true}\n');
  symlinkSync(localEslint, path.join(root, "node_modules", "eslint"), "dir");
  symlinkSync(packageRoot, path.join(root, "node_modules", "eslint-plugin-code-quality"), "dir");
  writeFileSync(
    path.join(root, "eslint.config.js"),
    'import codeQuality from "eslint-plugin-code-quality";\nexport default [...codeQuality.configs.recommended];\n',
  );
  return root;
}

function runHook(session, filePath, { preload } = {}) {
  const event = { hook_event_name: "PostToolUse", tool_name: "Edit", cwd: session, tool_input: { file_path: filePath } };
  const flags = preload ? ["--import", preload] : [];
  return spawnSync(process.execPath, [...flags, hookScript], {
    cwd: session,
    encoding: "utf8",
    input: JSON.stringify(event),
    env: { ...process.env, TMPDIR: session, CLAUDE_PROJECT_DIR: session },
  });
}

function countedCalls(stderr) {
  const line = stderr.split("\n").find((text) => text.startsWith("fs-calls "));
  assert.ok(line, `the counter printed nothing: ${stderr}`);
  return JSON.parse(line.slice("fs-calls ".length));
}

const NARRATION = "// Previously this returned zero.\nexport const answer = 42;\n";

test("an edit the extension test declines makes no filesystem call", () => {
  const session = makeConsumer();
  const preload = counter();
  for (const name of ["notes.md", "settings.json"]) {
    write(session, name, "not JavaScript\n");
    const result = runHook(session, name, { preload });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(countedCalls(result.stderr), [], name);
  }
});

test("the session's directory is resolved to its real path once per edit", () => {
  const session = makeConsumer();
  write(session, "src/clean.js", "export const answer = 42;\n");
  const result = runHook(session, "src/clean.js", { preload: counter() });
  assert.equal(result.status, 0, result.stderr);
  const resolved = countedCalls(result.stderr).filter(
    ([name, argument]) => name === "realpathSync" && argument === session,
  );
  assert.equal(resolved.length, 1);
});

test("each kind of edit ends as it did before the resolver was folded", () => {
  const session = makeConsumer();
  write(session, "notes.md", "not JavaScript\n");
  write(session, "src/fail.js", NARRATION);
  const beside = makeConsumer("code quality beside ");
  writeFileSync(path.join(beside, ".git"), "gitdir: /elsewhere/.git/worktrees/one\n");
  const besideFile = write(beside, "src/fail.js", NARRATION);

  const md = runHook(session, "notes.md");
  assert.deepEqual([md.status, md.stderr], [0, ""]);
  const inside = runHook(session, "src/fail.js");
  assert.equal(inside.status, 2, inside.stderr);
  assert.match(inside.stderr, /no-historical-narration/);
  const outside = runHook(session, besideFile);
  assert.equal(outside.status, 2, outside.stderr);
  assert.match(outside.stderr, /no-historical-narration/);
  const missing = runHook(session, "src/missing.js");
  assert.deepEqual([missing.status, missing.stderr], [0, ""]);
});

/* The workspace walk is a prefix test of the real file against the root it is handed, so under a
   session named through a link that root has to be real too, or no directory above the file matches
   and the root answers for every nested package (ISS-2939). */
function linkedConsumer(prefix, { eslint = true } = {}) {
  const real = eslint ? makeConsumer(prefix) : tempRoom(prefix);
  if (!eslint) {
    writeFileSync(path.join(real, "package.json"), '{"type":"module","private":true}\n');
    writeFileSync(path.join(real, "eslint.config.js"), "export default [];\n");
  }
  const link = path.join(tempRoom("code quality link "), "session");
  symlinkSync(realpathSync(real), link, "dir");
  return { real, link };
}

function nestedPackage(root, name) {
  write(root, `packages/${name}/eslint.config.js`, "export default [{ files: ['**/*.js'], rules: {} }];\n");
  write(root, `packages/${name}/package.json`, '{"type":"module","private":true}\n');
  return write(root, `packages/${name}/src/fail.js`, NARRATION);
}

test("a nested package under a session named through a link is judged by its own configuration", () => {
  const { real, link } = linkedConsumer("code quality real ");
  nestedPackage(real, "lenient");
  const result = runHook(link, "packages/lenient/src/fail.js");
  assert.deepEqual([result.status, result.stderr], [0, ""]);
});

test("a nested package's own opt-out holds under a session named through a link", () => {
  const { real, link } = linkedConsumer("code quality opt out ");
  nestedPackage(real, "quiet");
  write(real, "packages/quiet/eslint.config.js", "throw new Error('the hook read a configuration it was told to leave');\n");
  write(real, "packages/quiet/code-quality.json", '{"hook":false}\n');
  const result = runHook(link, "packages/quiet/src/fail.js");
  assert.deepEqual([result.status, result.stderr], [0, ""]);
});

test("a nested package configuring ESLint with none installed is told so under a link", () => {
  const { real, link } = linkedConsumer("code quality bare ", { eslint: false });
  nestedPackage(real, "bare");
  const result = runHook(link, "packages/bare/src/fail.js");
  assert.equal(result.status, 2, result.stderr);
  assert.ok(
    result.stderr.startsWith(
      `code-quality: ${path.join("packages", "bare", "eslint.config.js")} configures ESLint, but ESLint is not installed in ${path.join("packages", "bare")} `,
    ),
    result.stderr,
  );
});

test("a refusal under a session named through a link names the file from the directory named", () => {
  const { real, link } = linkedConsumer("code quality named ");
  write(real, "src/fail.js", NARRATION);
  const result = runHook(link, "src/fail.js");
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stderr.split("\n")[0], `code-quality: ${path.join("src", "fail.js")}`);
  assert.match(result.stderr, /no-historical-narration/);
});
