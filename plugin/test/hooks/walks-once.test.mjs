/* A hook runs on every tool call, so a read it repeats is paid on every call. Each case counts one kind
   of read inside the spawned hook, through a preload written at run time so no file in the tree is a
   module nothing imports, and holds the count to what one answer needs. */
import assert from "node:assert/strict";
import test from "node:test";
import fs, { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { callHook, projectRecord, tempRoom } from "../fixtures.mjs";

const TURN = new URL("../../hooks/entries/codex/codex-turn.mjs", import.meta.url).pathname;
const OWED = new URL("../../hooks/entries/codex/codex-owed.mjs", import.meta.url).pathname;

const PRELOAD = join(tempRoom("walks-once-preload-"), "count.mjs");
writeFileSync(PRELOAD, [
  'import fs from "node:fs";',
  'import { syncBuiltinESMExports } from "node:module";',
  "const { fn, suffix } = JSON.parse(process.env.COUNT_WHAT);",
  "const real = fs[fn];",
  "let n = 0;",
  "fs[fn] = (path, ...rest) => { if (String(path).endsWith(suffix)) n += 1; return real(path, ...rest); };",
  "syncBuiltinESMExports();",
  'process.on("exit", () => fs.writeFileSync(process.env.COUNT_TO, String(n)));',
].join("\n"));

/* How many times the hook called `fn` on a path ending in `suffix` while it answered `event`. */
const counted = (hook, event, env, fn, suffix) => {
  const to = join(tempRoom("walks-once-count-"), "n");
  const run = callHook(hook, event, {
    ...env, NODE_OPTIONS: `--import=${PRELOAD}`, COUNT_WHAT: JSON.stringify({ fn, suffix }), COUNT_TO: to,
  });
  assert.equal(run.status, 0, run.stderr);
  return Number(readFileSync(to, "utf8"));
};

const checkout = (room, name) => {
  const root = join(room, name);
  mkdirSync(join(root, "docs"), { recursive: true });
  spawnSync("git", ["init", "-q", root]);
  return root;
};

/* Criteria 4 and 5. The run home is read off the tree's git directory, one walk per directory the call
   wrote into; three files beside each other cost what one does, and one costs one walk. */
test("codex-turn walks to the git directory once per directory a call wrote into, however many files it holds", () => {
  const room = tempRoom("walks-once-turn-");
  const home = join(room, "home");
  mkdirSync(home);
  const root = checkout(room, "tree");
  const names = ["a.md", "b.md", "c.md"].map((one) => join(root, "docs", one));
  for (const one of names) writeFileSync(one, "x\n");
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: home, FORGE_CODEX_DISABLE: "" };
  const walks = (files) => counted(TURN, {
    hook_event_name: "PostToolUse", session_id: "walks", tool_name: "Bash",
    tool_input: { command: `touch ${files.join(" ")}` }, cwd: root,
  }, env, "statSync", "/docs/.git");
  /* Counted where a walk starts from the written file's directory, which only this reading does: the
     settings and the session key walk from the hook's own cwd. */
  assert.equal(walks(names.slice(0, 1)), 1, "one file reads the scratch off one walk, not one per record");
  assert.equal(walks(names), 1, "and three files in that directory cost the same walk");
});

/* Criterion 3. Two trees under one home, each gated by the same line, read one log. */
test("codex-owed reads the consult log once for a call gating two trees under one home", () => {
  const room = tempRoom("walks-once-owed-");
  mkdirSync(join(room, "forge"), { recursive: true });
  writeFileSync(join(room, "forge", "codex-log.jsonl"), "");
  const gated = { slug: "fixture", codex: { owed: ["gate"] }, stats: { commands: { gate: "npm run check" } } };
  const one = checkout(room, "one");
  const two = checkout(room, "two");
  for (const tree of [one, two]) projectRecord(tree, room, gated);
  const env = { ...process.env, HOME: room, XDG_CONFIG_HOME: room, FORGE_CODEX_DISABLE: "" };
  const reads = counted(OWED, {
    hook_event_name: "PreToolUse", session_id: "walks", tool_name: "Bash",
    tool_input: { command: `npm run check && cd ${two} && npm run check` }, cwd: one,
  }, env, "readFileSync", "codex-log.jsonl");
  assert.equal(reads, 1);
});

/* Criterion 8, in process: the predicate a gate is handed answers a directory once for every file in it. */
test("the lint configuration check reads a directory once for the files that share it", async () => {
  const { lintConfigured } = await import("../../src/hooks/lint-delegate.mjs");
  const room = tempRoom("walks-once-lint-");
  const root = checkout(room, "tree");
  writeFileSync(join(root, "eslint.config.js"), "export default [];\n");
  const real = fs.existsSync;
  let asked = 0;
  fs.existsSync = (path) => {
    asked += 1;
    return real(path);
  };
  syncBuiltinESMExports();
  try {
    const configured = lintConfigured();
    assert.equal(configured(join(root, "docs", "a.mjs")), true);
    const first = asked;
    assert.equal(configured(join(root, "docs", "b.mjs")), true);
    assert.equal(asked, first, "the second file of the directory reads nothing");
    assert.equal(lintConfigured()(join(root, "docs", "c.mjs")), true);
    assert.ok(asked > first, "and a predicate handed to the next call reads afresh");
  } finally {
    fs.existsSync = real;
    syncBuiltinESMExports();
  }
});
