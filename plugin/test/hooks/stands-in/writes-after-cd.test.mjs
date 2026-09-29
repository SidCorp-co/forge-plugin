/* Where a relative name a Bash call spells is looked for, when a `cd` in the same command moved the
   shell. A delegated run reaches its worktree that way, because its shell's cwd resets between calls,
   so the event's cwd is not where the write lands and `touched()` recorded nothing for it
   (ISS-1608). The name is placed where the `cd` before it left the shell, ahead of the event's cwd. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { touched } from "../../../hooks/_hook.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { patience } from "../../patience.mjs";

const room = tempRoom("writes-cd-");
let NOW = Date.now();
beforeEach(() => { NOW = Date.now(); });
let made = 0;

/* The call began at `at`: the last assistant record is the message asking for its tool. */
const asked = (at) => {
  const path = join(room, `t-${(made += 1)}.jsonl`);
  const lines = [
    { type: "user", promptSource: "typed", timestamp: new Date(at - 60_000).toISOString() },
    {
      type: "assistant",
      timestamp: new Date(at).toISOString(),
      message: { content: [{ type: "tool_use", name: "Bash", input: { command: "x" } }] },
    },
  ];
  writeFileSync(path, `${lines.map((one) => JSON.stringify(one)).join("\n")}\n`);
  return path;
};

/* Two branches whose `a.md` differs, so a copy holding the second's bytes agrees with HEAD. */
const git = (at, ...args) =>
  spawnSync("git", ["-C", at, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: at, encoding: "utf8" });
const repoWithBranches = () => {
  const at = tempRoom("writes-cd-repo-");
  spawnSync("git", ["init", "-q", "-b", "one", at], { cwd: dirname(at), encoding: "utf8" });
  writeFileSync(join(at, "a.md"), "one\n");
  git(at, "add", "a.md");
  git(at, "commit", "-qm", "one");
  git(at, "checkout", "-qb", "two");
  writeFileSync(join(at, "a.md"), "two\n");
  git(at, "commit", "-qm", "two", "a.md");
  return { at: realpathSync(at), files: [realpathSync(join(at, "a.md"))] };
};

const shellIn = (cwd, command, floor = NOW - 20_000) => ({
  session_id: "s1",
  tool_name: "Bash",
  tool_input: { command },
  cwd,
  transcript_path: asked(floor),
});

const trees = (...names) => names.map((name) => {
  const at = join(room, "moved", `${name}-${(made += 1)}`);
  mkdirSync(join(at, "docs"), { recursive: true });
  return realpathSync(at);
});

const fresh = (at, rel) => {
  writeFileSync(join(at, rel), `${NOW}\n`);
  return realpathSync(join(at, rel));
};

test("a relative write after a cd is the file in the tree the cd left the shell in", () => {
  const [event, tree] = trees("event", "tree");
  const file = fresh(tree, "docs/a.md");
  assert.deepEqual(touched(shellIn(event, `cd ${tree} && printf x > docs/a.md`)), [file]);
});

test("one file reached both from the cd and from the event's cwd is named once", () => {
  const [tree] = trees("both");
  const file = fresh(tree, "docs/a.md");
  assert.deepEqual(touched(shellIn(tree, `cd ${tree} && printf x > docs/a.md`)), [file]);
  assert.deepEqual(touched(shellIn(tree, `cd docs && printf x > a.md; printf y >> docs/a.md`)), [file]);
});

test("where the cd tree and the event's cwd both hold the name, the cd tree's file is the write", () => {
  const [event, tree] = trees("event", "tree");
  fresh(event, "docs/a.md");
  const file = fresh(tree, "docs/a.md");
  assert.deepEqual(touched(shellIn(event, `cd ${tree} && printf x > docs/a.md`)), [file]);
});

test("with no cd, a relative write still lands against the event's cwd", () => {
  const [event] = trees("event");
  const file = fresh(event, "docs/a.md");
  assert.deepEqual(touched(shellIn(event, "printf x > docs/a.md")), [file]);
});

test("a name spelled absolutely after a cd is the file it spells, never one joined to the tree", () => {
  const [event, tree, other] = trees("event", "tree", "other");
  const file = fresh(other, "docs/a.md");
  mkdirSync(join(tree, other.slice(1), "docs"), { recursive: true });
  fresh(join(tree, other.slice(1)), "docs/a.md");
  assert.deepEqual(touched(shellIn(event, `cd ${tree} && printf x > ${file}`)), [file]);
});

test("a cd whose destination the text does not carry places nothing", () => {
  const [event, tree] = trees("event", "tree");
  const nowhere = fresh(tree, "docs/a.md");
  for (const move of ['cd "$WORKTREE"', "cd -", "cd"]) {
    const found = touched(shellIn(event, `${move} && printf x > docs/a.md`));
    assert.ok(!found.includes(nowhere), `${move} named ${found}`);
  }
  assert.deepEqual(touched(shellIn(event, `X=${tree}; cd "$X" && printf x > docs/a.md`)), [nowhere],
    "and one the command bound itself is carried, the binding being text");
});

test("a cd the command may not have taken still has the write at the event's cwd named", () => {
  const [event, tree] = trees("event", "tree");
  const file = fresh(event, "docs/a.md");
  assert.deepEqual(touched(shellIn(event, `cd ${tree} || true; printf x > docs/a.md`)), [file]);
});

test("one name spelled after two cds is two files", () => {
  const [event, one, two] = trees("event", "one", "two");
  const files = [fresh(one, "docs/a.md"), fresh(two, "docs/a.md")].sort();
  assert.deepEqual(
    touched(shellIn(event, `cd ${one} && printf x > docs/a.md; cd ${two} && printf y > docs/a.md`)),
    files,
  );
});

/* The exemption from the head check belongs to the file a write reached, not to its name: the same
   name only read in another tree is a mention there, which a checkout's restamp explains. */
test("a name written in one tree and only read in another is checked against the other's head", () => {
  const written = repoWithBranches();
  const read = repoWithBranches();
  writeFileSync(join(written.at, "a.md"), "two\n");
  writeFileSync(join(read.at, "a.md"), "two\n");
  const [event] = trees("event");
  assert.deepEqual(
    touched(shellIn(event, `cd ${written.at} && printf 'two\\n' > a.md; cd ${read.at} && cat a.md`)),
    [written.files[0]],
  );
});

/* Asked at every name, a reading that walked the command once per question made one `cd` and two
   thousand names cost eight seconds where the same command had cost a fifth of one. */
test("a long command after one cd is placed once, not once per name", () => {
  const command = `cd ${room} && ${Array.from({ length: 2_000 }, (_, i) => `cat f${i}.md`).join("; ")}`;
  const began = Date.now();
  assert.deepEqual(touched(shellIn(room, command)), []);
  const spent = Date.now() - began;
  assert.ok(spent < patience(1_000), `2 000 names after one cd took ${spent} ms to place`);
});
