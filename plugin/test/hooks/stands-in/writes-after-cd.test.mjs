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
import { git, tempRoom } from "../../fixtures.mjs";

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
   thousand names cost eight seconds where the same command had cost a fifth of one. What tells the two
   apart is how the cost grows, not what a clock reads under whatever else the machine runs: four
   times the names costs about four times as much when the command is walked once, and about sixteen
   when it is walked per name. Each length is timed twice, interleaved, and the cheaper kept, so a
   burst of load landing on one reading moves neither. */
const placing = (names) => {
  const command = `cd ${room} && ${Array.from({ length: names }, (_, i) => `cat f${i}.md`).join("; ")}`;
  const began = performance.now();
  assert.deepEqual(touched(shellIn(room, command)), []);
  return performance.now() - began;
};

test("a long command after one cd is placed once, not once per name", () => {
  placing(50);
  const [short, long] = [0, 1].reduce(([a, b]) => [Math.min(a, placing(500)), Math.min(b, placing(2_000))],
    [Infinity, Infinity]);
  const growth = long / short;
  assert.ok(growth < 8, `four times the names cost ${growth.toFixed(1)} times as much `
    + `(${Math.round(short)} ms for 500, ${Math.round(long)} ms for 2 000): the command is walked per name`);
});
