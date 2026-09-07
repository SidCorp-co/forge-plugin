/* The hook's half of `codex.mjs`: what a turn records, what it announces per repository, and what
   deciding that costs. Apart from the consult's own surface because neither has to be read for the
   other, and because one file holding both was at the max-lines limit (ISS-616). */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so nothing here can touch the caller's own state file. */
const sandbox = tempRoom("forge-codex-record-");
process.env.XDG_CONFIG_HOME = sandbox;
delete process.env.FORGE_CODEX_DISABLE;

const { afterTouch, hookRecord, pendingIn, statePath } = await import("../../src/codex/codex.mjs");
const { digest } = await import("../../src/codex/codex-api.mjs");

/* A `.git` that is a file is what a worktree has, and repoRoot only asks whether it exists. */
const REPO = join(sandbox, "repo");
mkdirSync(join(REPO, "docs"), { recursive: true });
mkdirSync(join(REPO, "src"), { recursive: true });
writeFileSync(join(REPO, ".git"), "gitdir: elsewhere\n");
for (const path of ["docs/PLAN.md", "docs/TWO.md", "src/codex.mjs"]) {
  writeFileSync(join(REPO, path), "x");
}
writeFileSync(join(sandbox, "outside.md"), "under no repository at all");

const state = () => JSON.parse(readFileSync(statePath(), "utf8"));
const clearState = () => rmSync(statePath(), { force: true });

/* `first` and `added` are different questions: the second new file of a turn is recorded but must
   not repeat the instruction the first one carried. */
test("only the first file of a turn is announced, and a repeat is neither", () => {
  const empty = afterTouch({}, REPO, "docs/A.md");
  assert.deepEqual(empty, { files: ["docs/A.md"], added: true, first: true });
  const held = { turns: { [REPO]: { files: ["docs/A.md"] } } };
  assert.deepEqual(afterTouch(held, REPO, "docs/B.md"), {
    files: ["docs/A.md", "docs/B.md"],
    added: true,
    first: false,
  });
  assert.deepEqual(afterTouch(held, REPO, "docs/A.md"), {
    files: ["docs/A.md"],
    added: false,
    first: false,
  });
});

/* One state file, many checkouts: keyed by root, or two repositories trade files with each other. */
test("a turn is remembered per repository, not per machine", () => {
  const held = { turns: { "/a": { files: ["docs/A.md"] }, "/b": { files: ["docs/B.md"] } } };
  assert.deepEqual(pendingIn(held, "/a"), ["docs/A.md"]);
  assert.deepEqual(pendingIn(held, "/b"), ["docs/B.md"]);
  assert.deepEqual(pendingIn(held, "/c"), []);
  assert.deepEqual(afterTouch(held, "/a", "docs/B.md").files, ["docs/A.md", "docs/B.md"]);
});

/* The caller decides what a turn is, because only the hook can see one. Told once, a repository is
   not told again until the next turn — and an unanswered list no longer answers for the silence. */
const teller = () => {
  const said = new Set();
  return (turn) => (root) => {
    const key = `${root}\0${turn}`;
    if (said.has(key)) return true;
    said.add(key);
    return false;
  };
};

test("the hook records a document once, and tells a repository once per turn", () => {
  clearState();
  const told = teller();
  const first = hookRecord({}, [join(REPO, "docs", "PLAN.md")], told("t1"));
  assert.match(first, /forge codex consult --diff --only blocker,major/, "the shape codex-second teaches");
  assert.match(first, /docs\/PLAN\.md/);
  assert.ok(first.split("\n").length <= 2 && first.length < 400, `a note, not a page: ${first.length} chars`);
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md"]);

  assert.equal(hookRecord({}, [join(REPO, "docs", "PLAN.md")], told("t1")), null, "recorded already");
  assert.equal(hookRecord({}, [join(REPO, "docs", "TWO.md")], told("t1")), null, "told already");
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md", "docs/TWO.md"]);

  writeFileSync(join(REPO, "docs", "THREE.md"), "x");
  const later = hookRecord({}, [join(REPO, "docs", "THREE.md")], told("t2"));
  assert.match(later, /docs\/THREE\.md/, "a new turn is told, with two files still pending");
  clearState();
});

test("a document the latest answered consult read at this content is not recorded again", () => {
  clearState();
  const file = join(REPO, "docs", "READ.md");
  writeFileSync(file, "read by codex");
  const consult = (ok) => ({
    kind: "consult",
    ok,
    reply: ok ? "CODEX: 0 findings" : null,
    root: REPO,
    files: ["docs/READ.md"],
    sent: [{ rel: "docs/READ.md", sha: digest("read by codex") }],
  });
  const told = teller();
  let opened = 0;
  const log = (entries) => () => {
    opened += 1;
    return entries;
  };

  assert.equal(hookRecord({}, [file], told("t1"), log([consult(true)])), null, "same content, already read");
  assert.ok(!existsSync(statePath()) || !pendingIn(state(), REPO).length, "nothing pending");
  assert.equal(opened, 1, "the log was read once, for the file that would be added");

  assert.match(hookRecord({}, [file], told("t2"), log([consult(false)])), /docs\/READ\.md/, "an unanswered consult read nothing");
  clearState();
  assert.match(hookRecord({}, [file], told("t3"), log([])), /docs\/READ\.md/, "never sent");
  clearState();
  writeFileSync(file, "changed since");
  assert.match(hookRecord({}, [file], told("t4"), log([consult(true)])), /docs\/READ\.md/, "changed since the consult");

  opened = 0;
  assert.equal(hookRecord({}, [file], told("t4"), log([consult(true)])), null, "already pending");
  assert.equal(hookRecord({}, [join(REPO, "src", "codex.mjs")], told("t4"), log([consult(true)])), null);
  assert.equal(opened, 0, "a pending or unrecordable file never opens the log");
  clearState();
});

/* One PostToolUse carrying three documents paid for three parses of the same whole log, which only
   grows. The memo is the invocation's, so no call here can be answered from a read made before it. */
test("one invocation reads the log at most once, and not at all where no path asks", () => {
  clearState();
  const told = teller();
  let opened = 0;
  const log = () => {
    opened += 1;
    return [];
  };
  const three = ["ONE.md", "TWO.md", "THREE.md"].map((one) => {
    const file = join(REPO, "docs", one);
    writeFileSync(file, one);
    return file;
  });

  assert.match(hookRecord({}, three, told("t1"), log), /docs\/ONE\.md/, "the first of the three is what is announced");
  assert.equal(opened, 1, "three documents, one read of the log");
  assert.deepEqual(pendingIn(state(), REPO).length, 3, "and all three recorded");

  clearState();
  opened = 0;
  assert.equal(hookRecord({}, [], told("t2"), log), null, "no paths, so nothing to compare");
  assert.equal(hookRecord({}, [join(sandbox, "outside.md")], told("t2"), log), null, "no repository, so no comparison");
  assert.equal(hookRecord({}, [join(REPO, "src", "codex.mjs")], told("t2"), log), null, "not a recordable name");
  assert.equal(opened, 0, "none of the three shapes gets as far as asking");

  process.env.FORGE_CODEX_DISABLE = "1";
  try {
    assert.equal(hookRecord({}, three, told("t3"), log), null, "disabled");
    assert.equal(opened, 0, "and the switch answers before any path is looked at");
  } finally {
    delete process.env.FORGE_CODEX_DISABLE;
  }
  clearState();
});

/* Two checkouts, one state file: a hook firing in each at the same moment must not write what it
   read, and each is told for itself. */
test("a second repository is told for itself, and neither loses the other's list", () => {
  clearState();
  const other = join(sandbox, "repo-two");
  mkdirSync(join(other, "docs"), { recursive: true });
  writeFileSync(join(other, ".git"), "gitdir: elsewhere\n");
  writeFileSync(join(other, "docs", "PLAN.md"), "x");
  const told = teller();
  assert.match(hookRecord({}, [join(REPO, "docs", "PLAN.md")], told("t1")), /docs\/PLAN\.md/);
  assert.match(hookRecord({}, [join(other, "docs", "PLAN.md")], told("t1")), /docs\/PLAN\.md/);
  assert.deepEqual(pendingIn(state(), REPO), ["docs/PLAN.md"]);
  assert.deepEqual(pendingIn(state(), other), ["docs/PLAN.md"]);
  clearState();
});

test("a path the filter does not cover, or no repository at all, is not recorded", () => {
  clearState();
  assert.equal(hookRecord({}, [join(REPO, "src", "codex.mjs")]), null);
  assert.equal(hookRecord({}, [join(sandbox, "outside.md")]), null);
  assert.equal(existsSync(statePath()), false);
});

test("the disable switch silences the record", (t) => {
  clearState();
  process.env.FORGE_CODEX_DISABLE = "1";
  t.after(() => {
    delete process.env.FORGE_CODEX_DISABLE;
    clearState();
  });
  assert.equal(hookRecord({}, [join(REPO, "docs", "PLAN.md")]), null);
});
