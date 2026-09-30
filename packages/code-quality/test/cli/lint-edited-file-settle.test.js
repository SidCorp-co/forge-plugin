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

/* The workspace walk compares the real file with the root it is handed, and the root handed for a
   file inside the session's directory is that directory as given. So under a session named through
   a link the nested package's own configuration is not found and the root's rules answer, which is
   what this case pins: folding the resolvers must hand on the same root, not the real path. */
test("a nested package under a session named through a link is judged as it was", () => {
  const real = makeConsumer("code quality real ");
  write(
    real,
    "packages/lenient/eslint.config.js",
    "export default [{ files: ['**/*.js'], rules: {} }];\n",
  );
  write(real, "packages/lenient/package.json", '{"type":"module","private":true}\n');
  write(real, "packages/lenient/src/fail.js", NARRATION);
  const link = path.join(tempRoom("code quality link "), "session");
  symlinkSync(realpathSync(real), link, "dir");

  const result = runHook(link, "packages/lenient/src/fail.js");
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /no-historical-narration/);
  assert.match(result.stderr, /packages[/\\]lenient[/\\]src[/\\]fail\.js/);
});
